import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { politeFetch, RateLimited } from './soda-token';
import { adminDb } from './firebase-admin';
import { loadImportedMovers, loadManifest, loadState, saveLite, saveState, type ImportManifest } from './registry-store';
import { ourMetrics } from './competitors';
import { zipLookup } from './geo';
import { backfillClosures, recordChanges } from './market-events';
import { monitorNetwork } from './network-monitor';
import { sendDailyRadar } from './radar';
import { isProvince, REGISTRY_AREAS, sizeScore, sortMovers, toMover, type AuthorityRow, type CensusRow, type Mover } from '@/lib/registry';

/**
 * Pulls the free FMCSA data (U.S. DOT open data, updated daily) into the
 * registry, one state at a time, and records daily history for tracked
 * competitors and for us. Runs hourly; each run refreshes the stalest states
 * within its time budget, so every state is refreshed about once a day.
 */
const CENSUS = 'https://data.transportation.gov/resource/az4n-8mr2.json';
const AUTHORITY = 'https://data.transportation.gov/resource/6eyk-hxee.json';
const PAGE = 20000;
const STALE_MS = 20 * 3600_000;
const PRIORITY = ['CA', 'WA'];

async function socrata<T>(url: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const qs = new URLSearchParams({ ...params, $limit: String(PAGE), $offset: String(offset) });
    const res = await politeFetch(`${url}?${qs}`, 45_000);
    if (!res.ok) throw new Error(`DOT open data answered ${res.status}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

/** Household-goods rows → movers, from the imported census file when there is one, otherwise the open-data API. */
async function fetchMovers(state: string, manifest: ImportManifest | null): Promise<{ rows: Mover[]; source: 'file' | 'api' }> {
  const imported = manifest ? await loadImportedMovers(state) : null;
  if (imported) {
    return {
      source: 'file',
      rows: imported.map(r => toMover(r, r.auth_mc !== undefined ? { mc: r.auth_mc || '', hhg: r.auth_hhg === 'Y', active: r.auth_active === 'Y', broker: r.auth_broker === 'Y' } : undefined, zipLookup)),
    };
  }
  const [census, authority] = await Promise.all([
    socrata<CensusRow>(CENSUS, { $where: `phy_state='${state}'${isProvince(state) ? " AND phy_country='CA'" : ''} AND crgo_household='X' AND status_code='A'`, $order: 'dot_number' }),
    socrata<Record<string, string>>(AUTHORITY, { $select: 'dot_number,docket_number,hhg_chk,common_stat,broker_stat', $where: `bus_state_code='${state}' AND (hhg_chk='Y' OR common_stat='A' OR broker_stat='A')`, $order: 'dot_number' }),
  ]);
  const auth = new Map<string, AuthorityRow>();
  for (const a of authority) {
    const dot = String(Number(a.dot_number || 0));
    const prev = auth.get(dot);
    const row = { mc: String(a.docket_number || ''), hhg: a.hhg_chk === 'Y', active: a.common_stat === 'A', broker: a.broker_stat === 'A' };
    // Several dockets per carrier: keep the household-goods / active one.
    if (!prev || (row.hhg && !prev.hhg) || (row.active && !prev.active)) auth.set(dot, row);
  }
  return { source: 'api', rows: census.map(r => toMover(r, auth.get(String(Number(r.dot_number || 0))), zipLookup)) };
}

export async function syncState(state: string): Promise<{ state: string; count: number; likely: number; changes: number; source: 'file' | 'api' }> {
  const manifest = await loadManifest(true);
  const { rows, source } = await fetchMovers(state, manifest);
  // Compare with the previous snapshot before replacing it (new, closed, grew, shrank).
  const previous = await loadState(state).catch(() => [] as Mover[]);
  await saveState(state, rows);
  await saveLite(state, rows);
  let changes = 0;
  if (previous.length) { try { changes = await recordChanges(state, previous, rows); } catch (error) { console.error('Change detection failed', state, error); } }

  const likely = rows.filter(m => m.likelyMover);
  const top = sortMovers(likely, 'size').slice(0, 300).map(m => ({
    dot: m.dot, name: m.name, dba: m.dba, city: m.city, state: m.state, zip: m.zip, county: m.county, phone: m.phone, email: m.email, site: m.site, mc: m.mc, org: m.org,
    units: m.units, drivers: m.drivers, miles: m.miles, added: m.added, interstate: m.interstate, hhgAuth: m.hhgAuth, broker: m.broker, lat: m.lat, lng: m.lng, moverScore: m.moverScore, size: Math.round(sizeScore(m)),
  }));
  // Per-county totals for the expansion view (likely movers only).
  const counties: Record<string, { movers: number; trucks: number }> = {};
  for (const m of likely) { if (!/^\d{3}$/.test(m.county)) continue; const c = (counties[m.county] ||= { movers: 0, trucks: 0 }); c.movers++; c.trucks += m.units; }
  const located = rows.filter(m => m.lat !== null && m.lng !== null) as (Mover & { lat: number; lng: number })[];
  // 2.5th-97.5th percentile box, so one mis-geocoded ZIP doesn't stretch a state across the map.
  const pct = (xs: number[], p: number) => xs.sort((x, y) => x - y)[Math.min(xs.length - 1, Math.max(0, Math.floor(xs.length * p)))];
  const bbox = located.length ? { south: pct(located.map(m => m.lat), 0.025), north: pct(located.map(m => m.lat), 0.975), west: pct(located.map(m => m.lng), 0.025), east: pct(located.map(m => m.lng), 0.975) } : null;
  await adminDb().doc(`registryStates/${state}`).set({
    state, count: rows.length, likely: likely.length, units: likely.reduce((n, m) => n + m.units, 0), drivers: likely.reduce((n, m) => n + m.drivers, 0),
    top, bbox, center: bbox ? [(bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2] : null, counties, updatedAt: FieldValue.serverTimestamp(),
    // Other for-hire carriers in the state, by category (from the census file import).
    source, importedAt: source === 'file' ? manifest!.generatedAt : null,
    carriers: source === 'file' ? manifest!.counts[state]?.carriers ?? 0 : null, categories: source === 'file' ? manifest!.counts[state]?.categories ?? {} : null,
  }, { merge: true });
  // First time for a state: load the last ~18 months of closures so the radar starts with history.
  const summary = (await adminDb().doc(`registryStates/${state}`).get()).data();
  if (!summary?.backfilledAt) {
    try { const n = await backfillClosures(state); await adminDb().doc(`registryStates/${state}`).update({ backfilledAt: FieldValue.serverTimestamp(), backfilled: n }); }
    catch (error) { console.error('Closure backfill failed', state, error); }
  }
  await updateTrackedCompetitors(rows);
  return { state, count: rows.length, likely: likely.length, changes, source };
}

/** Keeps tracked competitors' fleet numbers current and logs a daily snapshot. */
async function updateTrackedCompetitors(rows: Mover[]) {
  const byDot = new Map(rows.map(m => [m.dot, m]));
  const db = adminDb(), day = new Date().toISOString().slice(0, 10);
  // Firestore "in" is limited to 30 values, so read tracked competitors with a DOT and match in memory.
  const snap = await db.collection('competitors').where('dot', '>', '').select('dot', 'metrics').limit(5000).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    let writes = 0;
    for (const d of snap.docs.slice(i, i + 400)) {
      const m = byDot.get(d.data().dot);
      if (!m) continue;
      batch.update(d.ref, { 'metrics.trucks': m.units, 'metrics.drivers': m.drivers, registry: { units: m.units, drivers: m.drivers, miles: m.miles, hhgAuth: m.hhgAuth, interstate: m.interstate, updated: m.updated }, registrySyncedAt: FieldValue.serverTimestamp() });
      batch.set(d.ref.collection('history').doc(day), { day, trucks: m.units, drivers: m.drivers, miles: m.miles, at: FieldValue.serverTimestamp() }, { merge: true });
      writes += 2;
    }
    if (writes) await batch.commit();
  }
}

/** Once a day: our own numbers, for the growth log. */
export async function snapshotUs() {
  const db = adminDb(), day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`competitorSettings/us/history/${day}`);
  if ((await ref.get()).exists) return false;
  const [{ metrics }, passed, actionsDone] = await Promise.all([
    ourMetrics(),
    db.collection('competitors').where('status', '==', 'passed').count().get(),
    db.collection('competitors').select('actions').limit(2000).get(),
  ]);
  const done = actionsDone.docs.reduce((n, d) => n + (Array.isArray(d.data().actions) ? d.data().actions.filter((a: { done?: boolean }) => a.done).length : 0), 0);
  await ref.set({ day, metrics, passed: passed.data().count, actionsDone: done, at: FieldValue.serverTimestamp() });
  return true;
}

/** Refreshes the stalest states until the time budget runs out. */
/**
 * Refreshes the stalest state(s), gently: by default one state per run, so
 * the 15-minute schedule spreads ~96 small requests across the day (each
 * state refreshed about every 13 hours). Stops early if rate-limited.
 */
export async function runRegistrySync(budgetMs = 240_000, maxStates?: number) {
  const started = Date.now();
  const db = adminDb();
  const manifest = await loadManifest(true);
  const snap = await db.collection('registryStates').select('updatedAt', 'importedAt').get();
  const age = new Map(snap.docs.map(d => [d.id, (d.data().updatedAt as Timestamp | undefined)?.toMillis() || 0]));
  const imported = new Map(snap.docs.map(d => [d.id, d.data().importedAt as string | null | undefined]));
  // With a census file import: every state not yet loaded from the latest file (no API calls, so a few per run).
  // Without one: the stalest states from the open-data API, one per run.
  const due = (manifest ? REGISTRY_AREAS.filter(s => imported.get(s) !== manifest.generatedAt) : REGISTRY_AREAS.filter(s => Date.now() - (age.get(s) || 0) > STALE_MS))
    .sort((a, b) => (PRIORITY.includes(b) ? 1 : 0) - (PRIORITY.includes(a) ? 1 : 0) || (age.get(a) || 0) - (age.get(b) || 0));
  maxStates ??= manifest ? 4 : 1;
  const done: { state: string; count: number; likely: number; changes: number; source: 'file' | 'api' }[] = [], failed: { state: string; error: string }[] = [];
  for (const state of due) {
    if (Date.now() - started > budgetMs || done.length + failed.length >= maxStates) break;
    try { done.push(await syncState(state)); }
    catch (error) { failed.push({ state, error: error instanceof Error ? error.message : String(error) }); if (error instanceof RateLimited) break; }
  }
  let snapshot = false;
  try { snapshot = await snapshotUs(); } catch (error) { console.error('Daily snapshot failed', error); }
  const daily = await runDailyTasks();
  return { done, failed, remaining: due.length - done.length - failed.length, snapshot, daily };
}

/**
 * Once a day after 7am Pacific (when the overnight state refreshes are in):
 * re-check partners' federal compliance and send the market radar email.
 */
export async function runDailyTasks() {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(now));
  if (hour < 7) return null;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now), ref = adminDb().doc(`marketSettings/daily-${day}`);
  const claimed = await adminDb().runTransaction(async tx => { if ((await tx.get(ref)).exists) return false; tx.create(ref, { startedAt: FieldValue.serverTimestamp() }); return true; });
  if (!claimed) return null;
  const out: Record<string, unknown> = {};
  try { out.monitor = await monitorNetwork(); } catch (error) { console.error('Network monitor failed', error); }
  try { out.radar = await sendDailyRadar(); } catch (error) { console.error('Market radar failed', error); }
  await ref.set({ ...out, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
  return out;
}

export { loadState };
