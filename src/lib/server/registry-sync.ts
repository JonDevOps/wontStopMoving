import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { loadState, saveState } from './registry-store';
import { ourMetrics } from './competitors';
import zipLatLng from '@/data/zip-latlng.json';
import { sizeScore, sortMovers, toMover, US_STATES, type AuthorityRow, type CensusRow, type Mover } from '@/lib/registry';

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
const zips = zipLatLng as unknown as Record<string, [number, number]>;
const zipLookup = (zip: string) => zips[zip] || null;

async function socrata<T>(url: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const qs = new URLSearchParams({ ...params, $limit: String(PAGE), $offset: String(offset) });
    const res = await fetch(`${url}?${qs}`, { signal: AbortSignal.timeout(45_000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`DOT open data answered ${res.status}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

export async function syncState(state: string): Promise<{ state: string; count: number; likely: number }> {
  const [census, authority] = await Promise.all([
    socrata<CensusRow>(CENSUS, { $where: `phy_state='${state}' AND crgo_household='X' AND status_code='A'`, $order: 'dot_number' }),
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
  const rows = census.map(r => toMover(r, auth.get(String(Number(r.dot_number || 0))), zipLookup));
  await saveState(state, rows);

  const likely = rows.filter(m => m.likelyMover);
  const top = sortMovers(likely, 'size').slice(0, 300).map(m => ({
    dot: m.dot, name: m.name, dba: m.dba, city: m.city, state: m.state, zip: m.zip, county: m.county, phone: m.phone, email: m.email, site: m.site, mc: m.mc, org: m.org,
    units: m.units, drivers: m.drivers, miles: m.miles, added: m.added, interstate: m.interstate, hhgAuth: m.hhgAuth, broker: m.broker, lat: m.lat, lng: m.lng, moverScore: m.moverScore, size: Math.round(sizeScore(m)),
  }));
  const located = rows.filter(m => m.lat !== null && m.lng !== null) as (Mover & { lat: number; lng: number })[];
  // 2.5th-97.5th percentile box, so one mis-geocoded ZIP doesn't stretch a state across the map.
  const pct = (xs: number[], p: number) => xs.sort((x, y) => x - y)[Math.min(xs.length - 1, Math.max(0, Math.floor(xs.length * p)))];
  const bbox = located.length ? { south: pct(located.map(m => m.lat), 0.025), north: pct(located.map(m => m.lat), 0.975), west: pct(located.map(m => m.lng), 0.025), east: pct(located.map(m => m.lng), 0.975) } : null;
  await adminDb().doc(`registryStates/${state}`).set({
    state, count: rows.length, likely: likely.length, units: likely.reduce((n, m) => n + m.units, 0), drivers: likely.reduce((n, m) => n + m.drivers, 0),
    top, bbox, center: bbox ? [(bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2] : null, updatedAt: FieldValue.serverTimestamp(),
  });
  await updateTrackedCompetitors(rows);
  return { state, count: rows.length, likely: likely.length };
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
export async function runRegistrySync(budgetMs = 240_000) {
  const started = Date.now();
  const db = adminDb();
  const snap = await db.collection('registryStates').select('updatedAt').get();
  const age = new Map(snap.docs.map(d => [d.id, (d.data().updatedAt as Timestamp | undefined)?.toMillis() || 0]));
  const due = US_STATES.filter(s => Date.now() - (age.get(s) || 0) > STALE_MS)
    .sort((a, b) => (PRIORITY.includes(b) ? 1 : 0) - (PRIORITY.includes(a) ? 1 : 0) || (age.get(a) || 0) - (age.get(b) || 0));
  const done: { state: string; count: number; likely: number }[] = [], failed: { state: string; error: string }[] = [];
  for (const state of due) {
    if (Date.now() - started > budgetMs) break;
    try { done.push(await syncState(state)); }
    catch (error) { failed.push({ state, error: error instanceof Error ? error.message : String(error) }); }
  }
  let snapshot = false;
  try { snapshot = await snapshotUs(); } catch (error) { console.error('Daily snapshot failed', error); }
  return { done, failed, remaining: due.length - done.length - failed.length, snapshot };
}

export { loadState };
