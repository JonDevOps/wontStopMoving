import { adminDb } from './firebase-admin';
import { loadCarriers, loadNational, loadPartners, loadStates } from './registry-store';
import { zipLookup } from './geo';
import { CATEGORY_COLOR, CATEGORY_KEYS, filterCarriers, primaryCategory, sortCarriers, tupleToMover, type CategoryKey, type LocatedCarrier } from '@/lib/carriers';
import { explainRank, filterMovers, ourRank, REGION_PRESETS, sizeScore, sortMovers, REGISTRY_AREAS, yearsInBusiness, type Mover, type MoverFilters, type OurFleet, type SortKey, type UsProfile } from '@/lib/registry';

/**
 * Answers registry searches. Searches inside a region, a few states or a map
 * area load those states' full lists. Nationwide searches use each state's
 * stored top-300 summary (the biggest likely movers), which keeps memory low.
 */
export type StateSummary = { state: string; count: number; likely: number; carriers?: number | null; partners?: number | null; categories?: Record<string, number> | null; units: number; drivers: number; top: (Partial<Mover> & { size: number })[]; updatedAt: string | null; bbox: { south: number; west: number; north: number; east: number } | null; center: [number, number] | null };

let summaryCache: { at: number; rows: StateSummary[] } | null = null;
export async function stateSummaries(force = false): Promise<StateSummary[]> {
  if (!force && summaryCache && Date.now() - summaryCache.at < 5 * 60_000) return summaryCache.rows;
  const snap = await adminDb().collection('registryStates').get();
  const rows = snap.docs.map(d => { const x = d.data(); return { ...x, state: d.id, updatedAt: x.updatedAt?.toDate?.().toISOString() || null } as StateSummary; });
  summaryCache = { at: Date.now(), rows };
  return rows;
}

const overlaps = (a: NonNullable<StateSummary['bbox']>, b: NonNullable<MoverFilters['bbox']>) => !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);

/**
 * '' = moving companies (the default), 'partners' = the partner shortlist
 * (each state's best freight, car-carrier, container... candidates), or one
 * service category of other for-hire carriers.
 */
export type CarrierType = '' | 'partners' | Exclude<CategoryKey, 'household'>;
export const CARRIER_TYPES = ['partners', ...CATEGORY_KEYS.filter(k => k !== 'household')] as Exclude<CarrierType, ''>[];

export type RegistryQuery = MoverFilters & { type?: CarrierType; sort?: SortKey; page?: number; pageSize?: number; rankBy?: 'size' | 'units' | 'drivers' };

export async function searchRegistry(q: RegistryQuery, us: UsProfile | null, opts: { points?: boolean; all?: boolean } = {}) {
  const summaries = await stateSummaries();
  let states: string[] = [];
  if (q.region && REGION_PRESETS[q.region]) states = [REGION_PRESETS[q.region].state];
  else if (q.states?.length) states = q.states.filter(s => REGISTRY_AREAS.includes(s));
  else if (q.bbox) states = summaries.filter(s => s.bbox && overlaps(s.bbox, q.bbox!)).map(s => s.state);

  const national = !states.length || states.length > 6;
  if (q.type) return searchCarriers(q, q.type, states, national, summaries, opts);
  let rows: Mover[];
  let complete = true;
  if (national) {
    // Nationwide: each state's biggest likely movers.
    // Every likely mover in the country (light files), falling back to each state's top 300 for states not refreshed yet.
    const nat = await loadNational(REGISTRY_AREAS);
    const have = new Set(nat.states);
    const fallback = summaries.filter(s => !have.has(s.state)).flatMap(s => s.top.map(t => ({ ...t, likelyMover: true }) as Mover));
    const pool = [...nat.rows, ...fallback].filter(m => !states.length || states.includes(m.state));
    rows = filterMovers(pool, { ...q, states: undefined, likelyOnly: false });
    complete = summaries.every(s => have.has(s.state));
  } else {
    rows = filterMovers(await loadStates(states), { ...q, states: q.region ? undefined : states });
  }
  const near = q.near ? { lat: q.near.lat, lng: q.near.lng } : undefined;
  const sorted = sortMovers(rows, q.sort || 'size', near);
  const pageSize = Math.min(Math.max(q.pageSize || 50, 1), opts.all ? 10000 : 200);
  const page = Math.max(q.page || 1, 1);
  const rank = us ? ourRank(rows, us, q.rankBy || 'size') : null;
  return {
    mode: national ? 'national' as const : 'detailed' as const,
    nationalComplete: national ? complete : undefined,
    states: national ? summaries.map(s => s.state) : states,
    total: sorted.length,
    rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    all: opts.all ? sorted : undefined,
    rank: rank ? { rank: rank.rank, of: rank.of, nextUp: rank.nextUp.map(m => ({ dot: m.dot, name: m.dba || m.name, city: m.city, state: m.state, units: m.units, drivers: m.drivers, years: yearsInBusiness(m), gap: rank.gapTo(m) })) } : null,
    explain: us ? explainRank(rows, us) : null,
    points: opts.points ? sorted.filter(m => m.lat !== null && m.lng !== null).slice(0, national ? 30000 : 15000).map(m => [m.dot, m.lat, m.lng, m.dba || m.name, m.units, m.state]) : undefined,
    totals: { units: rows.reduce((n, m) => n + m.units, 0), drivers: rows.reduce((n, m) => n + m.drivers, 0) },
    updatedAt: summaries.filter(s => !national ? states.includes(s.state) : true).map(s => s.updatedAt).filter(Boolean).sort().pop() || null,
  };
}

/** Our fleet for ranking, from Competitors → Our numbers. */
export async function ourFleet(): Promise<UsProfile> {
  // Until Wont Stop Moving has its own USDOT record, authority comes from the owner's setting (competitorSettings/us.hasAuthority).
  const settings = (await adminDb().doc('competitorSettings/us').get()).data() || {};
  const m = settings.metrics || {};
  return { units: Number(m.trucks || 0), drivers: Number(m.drivers || 0), miles: 0, years: Number(m.yearsInBusiness || 0), hasAuthority: settings.hasAuthority === true, hasWebsite: true };
}

/** Find one company by DOT number in its state's file. */
export async function findMover(dot: string, state: string): Promise<Mover | null> {
  const rows = await loadStates([state]);
  return rows.find(m => m.dot === dot) || null;
}

export { sizeScore };

/**
 * Other for-hire carriers (freight, car carriers, …): a region, a few states
 * or a map area at a time; state files are big, so no nationwide lists.
 */
async function searchCarriers(q: RegistryQuery, type: Exclude<CarrierType, ''>, states: string[], national: boolean, summaries: StateSummary[], opts: { points?: boolean; all?: boolean }) {
  const preset = q.region ? REGION_PRESETS[q.region] : undefined;
  let matches: (LocatedCarrier & { state: string })[] = [];
  if (!national) {
    for (const state of states) {
      for (const m of filterCarriers(type === 'partners' ? await loadPartners(state) : await loadCarriers(state, type), { ...q, counties: preset?.counties }, zipLookup)) matches.push({ ...m, state });
    }
  }
  matches = sortCarriers(matches, q.sort || (type === 'partners' ? 'score' : 'size'), q.near) as typeof matches;
  const toRow = (m: (typeof matches)[number]) => tupleToMover(m.t, m.state, m.lat !== null && m.lng !== null ? [m.lat, m.lng] : null);
  const pageSize = Math.min(Math.max(q.pageSize || 50, 1), opts.all ? 10000 : 200), page = Math.max(q.page || 1, 1);
  return {
    mode: national ? 'national' as const : 'detailed' as const, nationalComplete: undefined, needsArea: national,
    states: national ? summaries.map(s => s.state) : states, total: matches.length,
    rows: matches.slice((page - 1) * pageSize, page * pageSize).map(toRow), all: opts.all ? matches.slice(0, 20000).map(toRow) : undefined,
    rank: null, explain: null,
    // Shortlist pins are colored by category; single-category pins by fleet size.
    points: opts.points ? matches.filter(m => m.lat !== null && m.lng !== null).slice(0, 15000).map(m => type === 'partners' ? [m.t[0], m.lat, m.lng, m.t[2] || m.t[1], m.t[8], m.state, CATEGORY_COLOR[primaryCategory(m.t[13])]] : [m.t[0], m.lat, m.lng, m.t[2] || m.t[1], m.t[8], m.state]) : undefined,
    totals: { units: matches.reduce((n, m) => n + m.t[8], 0), drivers: matches.reduce((n, m) => n + m.t[9], 0) },
    updatedAt: summaries.filter(s => !national ? states.includes(s.state) : true).map(s => s.updatedAt).filter(Boolean).sort().pop() || null,
  };
}
