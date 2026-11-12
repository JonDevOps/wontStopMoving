import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { COUNTY_MOVING, COUNTY_POP, ZIPS, ZIP_COUNTY } from './geo';
import { loadState } from './registry-store';
import { stateSummaries } from './registry-query';
import { acquisitionScore, countyKey, expansionScore, isRecruitCandidate, milesBetween, moversPer10k, STATE_FIPS, zipOf, type CountyRow } from '@/lib/market';
import { REGION_PRESETS, inArea } from '@/lib/regions';
import { sortMovers, REGISTRY_AREAS, US_STATES, yearsInBusiness, type Mover } from '@/lib/registry';

/** Areas the radar watches and where alerts go (marketSettings/radar). */
export type RadarSettings = { regions: string[]; states: string[]; email: string };
export async function radarSettings(): Promise<RadarSettings> {
  const s = (await adminDb().doc('marketSettings/radar').get()).data() || {};
  return {
    regions: Array.isArray(s.regions) ? s.regions.filter((r: string) => REGION_PRESETS[r]) : ['bay-area', 'puget-sound'],
    states: Array.isArray(s.states) ? s.states.filter((x: string) => REGISTRY_AREAS.includes(x)) : [],
    email: typeof s.email === 'string' && s.email ? s.email : process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
  };
}
export const watchedStates = (s: RadarSettings) => [...new Set([...s.regions.flatMap(r => REGION_PRESETS[r].states), ...s.states])];
/** Is a company inside the watched areas (preset counties, or a whole watched state)? */
export const inWatch = (s: RadarSettings, m: { state: string; county: string }) =>
  s.states.includes(m.state) || s.regions.some(r => inArea(REGION_PRESETS[r], m.state, m.county));

// ---- Where to expand ------------------------------------------------------------

const FIPS_STATE = Object.fromEntries(Object.entries(STATE_FIPS).map(([s, f]) => [f, s]));

/** Every county: people, likely movers, our quote requests and bookings (last 180 days), and an opportunity score. */
export async function expansion(states?: string[]): Promise<(CountyRow & { per10k: number; score: number; trucksPer10k: number; registryMovers: number; censusBusinesses: number | null; censusEmployees: number | null })[]> {
  const [summaries, quotes, jobs] = await Promise.all([
    stateSummaries(),
    adminDb().collection('quotes').where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 180 * 86400000)).select('pickupZip', 'pickupAddress').limit(20000).get(),
    adminDb().collection('jobs').where('paidAt', '>=', Timestamp.fromMillis(Date.now() - 180 * 86400000)).select('pickupAddress').limit(20000).get(),
  ]);
  const demand = new Map<string, { quotes: number; bookings: number }>();
  const bump = (zip: string, k: 'quotes' | 'bookings') => { const c = ZIP_COUNTY[zip]; if (!c) return; const d = demand.get(c) || { quotes: 0, bookings: 0 }; d[k]++; demand.set(c, d); };
  for (const d of quotes.docs) bump(d.data().pickupZip ? String(d.data().pickupZip).slice(0, 5) : zipOf(d.data().pickupAddress), 'quotes');
  for (const d of jobs.docs) bump(zipOf(d.data().pickupAddress), 'bookings');
  const supply = new Map<string, { movers: number; trucks: number }>();
  for (const s of summaries) for (const [c3, v] of Object.entries((s as any).counties || {}) as [string, { movers: number; trucks: number }][]) supply.set(countyKey(s.state, c3), v);
  // A state is usable when the registry has loaded it (with matching county codes) or the Census counts its moving businesses.
  const matchedByState = new Map<string, number>();
  for (const [fips, v] of supply) if (COUNTY_POP[fips]) { const st = FIPS_STATE[fips.slice(0, 2)]; matchedByState.set(st, (matchedByState.get(st) || 0) + v.movers); }
  for (const [fips, [est]] of Object.entries(COUNTY_MOVING)) { const st = FIPS_STATE[fips.slice(0, 2)]; if (st) matchedByState.set(st, (matchedByState.get(st) || 0) + est); }
  const rows = Object.entries(COUNTY_POP).map(([fips, [name, population]]) => {
    const state = FIPS_STATE[fips.slice(0, 2)] || '';
    const sup = supply.get(fips) || { movers: 0, trucks: 0 }, dem = demand.get(fips) || { quotes: 0, bookings: 0 };
    // Supply: the larger of the Census count (all moving businesses with employees) and DOT-registered movers.
    const census = COUNTY_MOVING[fips];
    const row: CountyRow = { fips, name, state, population, movers: Math.max(sup.movers, census?.[0] || 0), trucks: sup.trucks, quotes: dem.quotes, bookings: dem.bookings };
    return { ...row, registryMovers: sup.movers, censusBusinesses: census ? census[0] : null, censusEmployees: census ? census[1] : null, per10k: moversPer10k(row), trucksPer10k: population ? Math.round((sup.trucks / population) * 100000) / 10 : 0, score: expansionScore(row) };
  }).filter(r => r.state && (matchedByState.get(r.state) || 0) > 0 && (!states?.length || states.includes(r.state)));
  return rows.sort((a, b) => b.score - a.score);
}

// ---- Companies you could buy ---------------------------------------------------

export async function acquisitionTargets(states: string[], limit = 150) {
  const out: (Mover & { years: number; score: number; staleSince: string })[] = [];
  for (const st of states.slice(0, 6)) {
    for (const m of await loadState(st)) {
      const years = yearsInBusiness(m), score = acquisitionScore(m, years);
      if (score >= 40) out.push({ ...m, years, score, staleSince: m.updated });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---- Agent recruiting ------------------------------------------------------------

/** Established movers in a state that aren't agents or prospects yet. */
export async function recruitCandidates(state: string, limit = 60) {
  const db = adminDb();
  const [rows, agents, prospects, enr] = await Promise.all([
    loadState(state), db.collection('agents').select('usdot').get(), db.collection('agentProspects').select('dot').get(),
    db.collection('registryEnrichment').where('state', '==', state).select('kind').get(),
  ]);
  const taken = new Set([...agents.docs.map(d => String(Number(d.data().usdot || 0))), ...prospects.docs.map(d => String(d.data().dot || ''))]);
  const kind = new Map(enr.docs.map(d => [d.id, d.data().kind as string | undefined]));
  const list = rows.filter(m => !taken.has(m.dot) && isRecruitCandidate(m, yearsInBusiness(m)) && !['broker', 'freight', 'other'].includes(kind.get(m.dot) || ''));
  return sortMovers(list, 'size').slice(0, limit).map(m => ({ ...m, years: yearsInBusiness(m), kind: kind.get(m.dot) || null }));
}

// ---- Overflow partners for a job --------------------------------------------------

export async function overflowPartners(job: Record<string, any>, miles = 25) {
  const zip = zipOf(job.pickupAddress) || String(job.pickupZip || '').slice(0, 5);
  const center = ZIPS[zip];
  if (!center) return { zip, center: null, network: [], registry: [] };
  const db = adminDb();
  const [agents, providers] = await Promise.all([db.collection('agents').where('status', '==', 'approved').get(), db.collection('providers').where('status', '==', 'approved').get()]);
  const network = [
    ...agents.docs.map(d => ({ kind: 'agent' as const, id: d.id, name: d.data().companyName, phone: d.data().phone || '', ll: ZIPS[String(d.data().postalCode || '').slice(0, 5)], trucks: d.data().trucks || 0, free: d.data().availableTrucks ?? null, dot: String(Number(d.data().usdot || 0)) })),
    ...providers.docs.map(d => ({ kind: 'provider' as const, id: d.id, name: d.data().businessName || d.data().name || 'Provider', phone: d.data().phone || '', ll: d.data().location?.lat ? [d.data().location.lat, d.data().location.lng] as [number, number] : ZIPS[String(d.data().zipCode || '').slice(0, 5)], trucks: null, free: null, dot: '' })),
  ].filter(n => n.ll).map(n => ({ ...n, miles: Math.round(milesBetween(center, n.ll!) * 10) / 10, ll: undefined })).filter(n => n.miles <= miles * 2).sort((a, b) => a.miles - b.miles).slice(0, 15);
  const st = String(job.state || '').length === 2 ? job.state : US_STATES.find(s => (zip && Object.keys(STATE_FIPS).includes(s) && ZIP_COUNTY[zip]?.startsWith(STATE_FIPS[s]))) || '';
  const ours = new Set(network.map(n => n.dot).filter(Boolean));
  const registry = st ? (await loadState(st)).filter(m => m.likelyMover && m.units >= 2 && m.lat !== null && m.lng !== null && !ours.has(m.dot))
    .map(m => ({ ...m, years: yearsInBusiness(m), miles: Math.round(milesBetween(center, [m.lat!, m.lng!]) * 10) / 10 })).filter(m => m.miles <= miles)
    .sort((a, b) => (a.miles - b.miles) || (b.units - a.units)).slice(0, 25) : [];
  return { zip, center, network, registry };
}
