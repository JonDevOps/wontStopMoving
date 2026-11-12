import { loadNational } from './registry-store';
import { stateSummaries } from './registry-query';
import { classifyAndSave, enrichmentFor, strategyAndSave, type Enrichment } from './registry-enrich';
import { jevConfigured } from './jev';
import { matchPlace } from './places';
import { trackedByDot } from './registry-track';
import { brandOf, buildLegends, GROUP_LABEL, revenueRange, STATE_ZONE, type LegendGroup } from '@/lib/legends';
import { isProvince, REGISTRY_AREAS, sizeScore, yearsInBusiness, type Mover } from '@/lib/registry';
import { combineStats, type PlatformStats } from '@/lib/social-stats';

/** The Legends board: see src/lib/legends.ts for how companies are chosen. */
const US = REGISTRY_AREAS.filter(s => !isProvince(s));
const NOT_MOVERS = new Set(['broker', 'freight', 'other']);
const HOME = { lat: 37.3861, lng: -122.0839 }; // Mountain View, CA

export const milesFrom = (lat: number | null, lng: number | null) => {
  if (lat === null || lng === null) return null;
  const r = Math.PI / 180, dLat = (lat - HOME.lat) * r, dLng = (lng - HOME.lng) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(HOME.lat * r) * Math.cos(lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(a)));
};

let cache: { at: number; value: Awaited<ReturnType<typeof compute>> } | null = null;

async function compute() {
  const summaries = await stateSummaries();
  const nat = await loadNational(US);
  const have = new Set(nat.states);
  const fallback = summaries.filter(s => US.includes(s.state) && !have.has(s.state)).flatMap(s => s.top.map(t => ({ ...t, likelyMover: true }) as Mover));
  const all = [...nat.rows, ...fallback].filter(m => m.likelyMover !== false && STATE_ZONE[m.state]);

  // Read what we know about a generous pool of the biggest, then drop companies Jev sorted as not movers.
  const sorted = [...all].sort((a, b) => sizeScore(b) - sizeScore(a));
  const pool: Mover[] = [], seen = new Set<string>();
  const add = (list: Mover[]) => list.forEach(m => { if (!seen.has(m.dot)) { seen.add(m.dot); pool.push(m); } });
  add(sorted.slice(0, 800));
  for (const z of ['eastern', 'central', 'mountain', 'pacific', 'alaska', 'hawaii']) add(sorted.filter(m => STATE_ZONE[m.state] === z).slice(0, z === 'alaska' || z === 'hawaii' ? 30 : 300));
  const enr = await enrichmentFor(pool.map(m => m.dot));
  const groups = buildLegends(pool.filter(m => !NOT_MOVERS.has(enr.get(m.dot)?.kind || '')), sizeScore);

  // Franchise and van line networks across every likely mover in the country.
  const brandCounts: Record<string, number> = {};
  for (const m of all) { const b = brandOf(m); if (b) brandCounts[b.key] = (brandCounts[b.key] || 0) + 1; }
  return { groups, enr, brandCounts, states: nat.states.length, complete: US.every(s => have.has(s) || !summaries.some(x => x.state === s)) };
}

async function board(force = false) {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  cache = { at: Date.now(), value: await compute() };
  return cache.value;
}

export type LegendRow = ReturnType<typeof legendRow>;
function legendRow(m: Mover, rank: number, group: LegendGroup, e: Enrichment | undefined, tracked: Map<string, string>) {
  const brand = brandOf({ ...m, foundSite: e?.site });
  const stats = (e?.socialStats || {}) as Record<string, { followers?: number | null }>;
  const followers = Object.values(stats).reduce((n, s) => n + (s?.followers || 0), 0);
  return {
    rank, group, dot: m.dot, state: m.state, name: m.name, dba: m.dba || '', city: m.city, units: m.units, drivers: m.drivers, miles: m.miles,
    years: yearsInBusiness(m), size: Math.round(sizeScore(m)), revenue: revenueRange(m), brand: brand ? { key: brand.key, label: brand.label, kind: brand.kind } : null,
    site: m.site || e?.site || null, socials: e?.socials || {}, followers: followers || null, milesFromUs: milesFrom(m.lat ?? null, m.lng ?? null),
    kind: e?.kind || null, strategy: e?.strategy || null, google: e?.placeId ? 'matched' : e?.placeCheckedAt ? 'none' : null,
    competitorId: tracked.get(m.dot) || e?.competitorId || null,
  };
}

export async function legends(force = false) {
  const b = await board(force);
  const tracked = await trackedByDot();
  const groups = Object.fromEntries((Object.keys(b.groups) as LegendGroup[]).map(g => [g, b.groups[g].map((m, i) => legendRow(m, i + 1, g, b.enr.get(m.dot), tracked))])) as Record<LegendGroup, LegendRow[]>;
  return { groups, brandCounts: b.brandCounts, statesLoaded: b.states, complete: b.complete, jev: jevConfigured() };
}

const BATCH = 40;
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const t = items[i++]; await fn(t); } }));
}

/** Matches up to 40 legends in a group to their Google place IDs (only the ID is kept). */
export async function matchGroup(group: LegendGroup) {
  const b = await board();
  const todo = b.groups[group].filter(m => !b.enr.get(m.dot)?.placeCheckedAt).slice(0, BATCH);
  let matched = 0, failed = 0, stopped = '';
  await pool(todo, 5, async m => {
    if (stopped) return;
    try { if (await matchPlace(m)) matched++; } catch (error) { if (/used up|set up/.test(String(error))) stopped = (error as Error).message; else failed++; }
  });
  cache = null;
  return { checked: todo.length, matched, failed, stopped: stopped || null, remaining: Math.max(0, b.groups[group].filter(m => !b.enr.get(m.dot)?.placeCheckedAt).length - todo.length) };
}

/** Jev's call on one company, from everything we know (our data only, never Google Maps content). */
export async function strategyFor(m: Mover, e?: Enrichment, group?: LegendGroup) {
  const kind = e?.kind || (await classifyAndSave(m)).kind;
  const r = revenueRange(m);
  const sum = combineStats((e?.socialStats || {}) as Record<string, PlatformStats>);
  return strategyAndSave(m, {
    kind, brand: brandOf({ ...m, foundSite: e?.site })?.label || null, milesFromUs: milesFrom(m.lat ?? null, m.lng ?? null),
    estimatedRevenue: `$${(r.low / 1e6).toFixed(1)}M-$${(r.high / 1e6).toFixed(1)}M (from fleet size)`, website: m.site || e?.site || null,
    socialPlatforms: Object.keys(e?.socials || {}), legendGroup: group ? GROUP_LABEL[group] : null,
    social: sum.platforms ? { followers: sum.followers, postsLast30: sum.postsLast30, daysSinceLastPost: sum.daysSinceLastPost } : null,
  });
}

/** Jev sorts up to 40 legends in a group, then says how we should treat each. */
export async function jevGroup(group: LegendGroup) {
  const b = await board();
  const todo = b.groups[group].filter(m => !b.enr.get(m.dot)?.strategy).slice(0, BATCH);
  let done = 0, failed = 0;
  await pool(todo, 6, async m => {
    try { await strategyFor(m, b.enr.get(m.dot), group); done++; }
    catch (error) { console.error('Jev legend failed', m.dot, error); failed++; }
  });
  cache = null;
  return { checked: todo.length, done, failed, remaining: Math.max(0, b.groups[group].filter(m => !b.enr.get(m.dot)?.strategy).length - todo.length) };
}
