import { adminDb } from './firebase-admin';
import { loadNational } from './registry-store';
import { REGISTRY_AREAS, yearsInBusiness, type Mover } from '@/lib/registry';
import { REGION_BY_CODE } from '@/lib/agents';
import { MOVE_PRICING } from '@/lib/pricing';

/**
 * Public city moving-market reports, built from the federal mover registry:
 * how many licensed movers a city has, how big and established they are,
 * how many are licensed for interstate moves, who opened or closed this
 * year, and local prices where we've read them. Aggregates only: no
 * individual competitor is named or rated.
 */
export const MIN_MOVERS = 6;

export const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const niceCity = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
export const areaName = (st: string) => REGION_BY_CODE.get(`US-${st}`)?.name || REGION_BY_CODE.get(`CA-${st}`)?.name || st;

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export type CityIndexEntry = { state: string; stateName: string; city: string; slug: string; movers: number; trucks: number };

/** Cities with enough licensed movers for a meaningful report. */
export async function cityIndex(): Promise<CityIndexEntry[]> {
  const { rows } = await loadNational(REGISTRY_AREAS);
  const by = new Map<string, CityIndexEntry>();
  for (const m of rows) {
    if (!m.city || !m.state) continue;
    const key = `${m.state}|${slug(m.city)}`;
    const e = by.get(key) || { state: m.state, stateName: areaName(m.state), city: niceCity(m.city), slug: slug(m.city), movers: 0, trucks: 0 };
    e.movers++; e.trucks += m.units;
    by.set(key, e);
  }
  return [...by.values()].filter(e => e.movers >= MIN_MOVERS && e.slug).sort((a, b) => b.movers - a.movers);
}

export type CityReport = {
  state: string; stateName: string; city: string; slug: string; updated: string | null;
  movers: number; trucks: number; drivers: number; medianFleet: number; medianYears: number; established10: number;
  interstatePct: number; authorityPct: number; withWebsitePct: number; newThisYear: number; closedThisYear: number;
  sizeBands: { label: string; count: number }[]; yearsBands: { label: string; count: number }[];
  statewide: { movers: number; medianFleet: number; medianYears: number };
  prices: { twoMovers: number | null; threeMovers: number | null; minimumHours: number | null; sample: number } | null;
  nearby: CityIndexEntry[]; ourStudio: number;
};

export async function cityReport(state: string, citySlug: string): Promise<CityReport | null> {
  if (!REGISTRY_AREAS.includes(state)) return null;
  const { rows } = await loadNational(REGISTRY_AREAS);
  const inState = rows.filter(m => m.state === state);
  const here = inState.filter(m => slug(m.city) === citySlug);
  if (here.length < MIN_MOVERS) return null;
  const now = Date.now(), yearAgo = new Date(now - 365 * 86400000).toISOString().slice(0, 10);
  const years = here.map(m => yearsInBusiness(m, now));
  const band = (list: Mover[], f: (m: Mover) => number, edges: [string, number, number][]) => edges.map(([label, lo, hi]) => ({ label, count: list.filter(m => f(m) >= lo && f(m) <= hi).length }));

  const db = adminDb();
  const [closed, prices] = await Promise.all([
    db.collection('registryEvents').where('day', '>=', yearAgo).limit(5000).get().then(s => s.docs.filter(d => d.data().type === 'closed' && d.data().state === state && slug(d.data().city || '') === citySlug).length).catch(() => 0),
    db.collection('priceIntel').where('state', '==', state).limit(500).get().then(s => s.docs.map(d => d.data()).filter(d => d.prices?.published)).catch(() => []),
  ]);
  const localPrices = prices.filter(p => slug(String(p.city || '').split(',')[0]) === citySlug);
  const usePrices = localPrices.length >= 3 ? localPrices : prices;
  const pick = (k: string) => { const xs = usePrices.map(p => p.prices?.[k]).filter((v: unknown): v is number => typeof v === 'number'); return xs.length >= 3 ? Math.round(median(xs)) : null; };

  const index = await cityIndex();
  const others = index.filter(e => e.state === state && e.slug !== citySlug).slice(0, 12);
  const updated = await db.doc(`registryStates/${state}`).get().then(d => d.data()?.updatedAt?.toDate?.().toISOString() || null).catch(() => null);

  return {
    state, stateName: areaName(state), city: niceCity(here[0].city), slug: citySlug, updated,
    movers: here.length, trucks: here.reduce((n, m) => n + m.units, 0), drivers: here.reduce((n, m) => n + m.drivers, 0),
    medianFleet: median(here.map(m => m.units)), medianYears: Math.round(median(years)), established10: years.filter(y => y >= 10).length,
    interstatePct: pct(here.filter(m => m.interstate).length, here.length), authorityPct: pct(here.filter(m => m.hhgAuth).length, here.length),
    withWebsitePct: pct(here.filter(m => m.site).length, here.length),
    newThisYear: here.filter(m => m.added && m.added >= yearAgo).length, closedThisYear: closed,
    sizeBands: band(here, m => m.units, [['1 truck or none', 0, 1], ['2–4 trucks', 2, 4], ['5–19 trucks', 5, 19], ['20+ trucks', 20, 1e9]]),
    yearsBands: band(here, m => yearsInBusiness(m, now), [['Under 2 years', 0, 1], ['2–4 years', 2, 4], ['5–9 years', 5, 9], ['10–19 years', 10, 19], ['20+ years', 20, 1e9]]),
    statewide: { movers: inState.length, medianFleet: median(inState.map(m => m.units)), medianYears: Math.round(median(inState.map(m => yearsInBusiness(m, now)))) },
    prices: usePrices.length >= 3 ? { twoMovers: pick('twoMovers'), threeMovers: pick('threeMovers'), minimumHours: pick('minimumHours'), sample: usePrices.length } : null,
    nearby: others, ourStudio: MOVE_PRICING.studio.baseFee,
  };
}

