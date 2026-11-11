import { adminDb } from './firebase-admin';
import { loadNational, loadStates } from './registry-store';
import { filterMovers, ourRank, REGION_PRESETS, sizeScore, sortMovers, REGISTRY_AREAS, yearsInBusiness, type Mover, type MoverFilters, type OurFleet, type SortKey } from '@/lib/registry';

/**
 * Answers registry searches. Searches inside a region, a few states or a map
 * area load those states' full lists. Nationwide searches use each state's
 * stored top-300 summary (the biggest likely movers), which keeps memory low.
 */
export type StateSummary = { state: string; count: number; likely: number; units: number; drivers: number; top: (Partial<Mover> & { size: number })[]; updatedAt: string | null; bbox: { south: number; west: number; north: number; east: number } | null; center: [number, number] | null };

let summaryCache: { at: number; rows: StateSummary[] } | null = null;
export async function stateSummaries(force = false): Promise<StateSummary[]> {
  if (!force && summaryCache && Date.now() - summaryCache.at < 5 * 60_000) return summaryCache.rows;
  const snap = await adminDb().collection('registryStates').get();
  const rows = snap.docs.map(d => { const x = d.data(); return { ...x, state: d.id, updatedAt: x.updatedAt?.toDate?.().toISOString() || null } as StateSummary; });
  summaryCache = { at: Date.now(), rows };
  return rows;
}

const overlaps = (a: NonNullable<StateSummary['bbox']>, b: NonNullable<MoverFilters['bbox']>) => !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);

export type RegistryQuery = MoverFilters & { sort?: SortKey; page?: number; pageSize?: number; rankBy?: 'size' | 'units' | 'drivers' };

export async function searchRegistry(q: RegistryQuery, us: OurFleet | null, opts: { points?: boolean; all?: boolean } = {}) {
  const summaries = await stateSummaries();
  let states: string[] = [];
  if (q.region && REGION_PRESETS[q.region]) states = [REGION_PRESETS[q.region].state];
  else if (q.states?.length) states = q.states.filter(s => REGISTRY_AREAS.includes(s));
  else if (q.bbox) states = summaries.filter(s => s.bbox && overlaps(s.bbox, q.bbox!)).map(s => s.state);

  const national = !states.length || states.length > 6;
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
    points: opts.points ? sorted.filter(m => m.lat !== null && m.lng !== null).slice(0, national ? 30000 : 15000).map(m => [m.dot, m.lat, m.lng, m.dba || m.name, m.units, m.state]) : undefined,
    totals: { units: rows.reduce((n, m) => n + m.units, 0), drivers: rows.reduce((n, m) => n + m.drivers, 0) },
    updatedAt: summaries.filter(s => !national ? states.includes(s.state) : true).map(s => s.updatedAt).filter(Boolean).sort()[0] || null,
  };
}

/** Our fleet for ranking, from Competitors → Our numbers. */
export async function ourFleet(): Promise<OurFleet> {
  const m = (await adminDb().doc('competitorSettings/us').get()).data()?.metrics || {};
  return { units: Number(m.trucks || 0), drivers: Number(m.drivers || 0), miles: 0, years: Number(m.yearsInBusiness || 0) };
}

/** Find one company by DOT number in its state's file. */
export async function findMover(dot: string, state: string): Promise<Mover | null> {
  const rows = await loadStates([state]);
  return rows.find(m => m.dot === dot) || null;
}

export { sizeScore };
