import { FieldValue } from 'firebase-admin/firestore';
import { sodaHeaders } from './soda-token';
import { adminDb } from './firebase-admin';
import { censusByDots, insuranceCancellationsFor, revocationsFor } from './fmcsa';
import { zipLookup } from './geo';
import { closureReason, diffMovers, type ChangeType } from '@/lib/market';
import { toMover, yearsInBusiness, type CensusRow, type Mover } from '@/lib/registry';

/**
 * Market events in registryEvents/{id}: a moving company appeared, closed,
 * grew or shrank. Closures carry the reason and date from FMCSA records
 * (revocation, insurance cancellation, inactive USDOT). Server-only.
 */
export type MarketEvent = {
  type: ChangeType; dot: string; state: string; county: string; zip: string; lat: number | null; lng: number | null;
  name: string; dba: string; city: string; phone: string; email: string; site: string; officer: string; mc: string;
  units: number; drivers: number; years: number; hhgAuth: boolean; interstate: boolean;
  from?: number; to?: number; reason?: string; effectiveDate?: string; confidence?: string; day: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function eventFrom(type: ChangeType, m: Mover, extra: Partial<MarketEvent> = {}): MarketEvent {
  return {
    type, dot: m.dot, state: m.state, county: m.county, zip: m.zip, lat: m.lat, lng: m.lng, name: m.name, dba: m.dba, city: m.city, phone: m.phone, email: m.email,
    site: m.site, officer: m.officer, mc: m.mc, units: m.units, drivers: m.drivers, years: yearsInBusiness(m), hhgAuth: m.hhgAuth, interstate: m.interstate, day: today(), ...extra,
  };
}

async function explainClosures(movers: Mover[]) {
  const dots = movers.map(m => m.dot);
  const [census, revs, ins] = await Promise.all([censusByDots(dots).catch(() => []), revocationsFor(dots).catch(() => new Map()), insuranceCancellationsFor(dots).catch(() => new Map())]);
  const status = new Map(census.map(r => [String(Number(r.dot_number)), r]));
  return new Map(movers.map(m => {
    const c = status.get(m.dot);
    const filing = c?.mcs150_date && /^\d{8}$/.test(c.mcs150_date) ? `${c.mcs150_date.slice(0, 4)}-${c.mcs150_date.slice(4, 6)}-${c.mcs150_date.slice(6)}` : m.updated;
    return [m.dot, closureReason({ status: c?.status_code, revocations: revs.get(m.dot) || [], insuranceCancelled: ins.get(m.dot) || [], lastFiling: filing })];
  }));
}

async function save(events: MarketEvent[]) {
  const db = adminDb();
  for (let i = 0; i < events.length; i += 400) {
    const batch = db.batch();
    for (const e of events.slice(i, i + 400)) {
      const id = e.type === 'closed' ? `closed-${e.dot}` : `${e.type}-${e.dot}-${e.day}`;
      batch.set(db.doc(`registryEvents/${id}`), { ...e, detectedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}

/** Compares a state's previous and new lists and stores what changed. */
export async function recordChanges(state: string, prev: Mover[], next: Mover[]) {
  const changes = diffMovers(prev, next);
  // A wholesale drop usually means a bad download, not hundreds of closures in one day.
  const closedCount = changes.filter(c => c.type === 'closed').length;
  if (closedCount > Math.max(50, prev.length * 0.05)) { console.warn('Suspicious registry drop; skipping closures', state, closedCount); }
  const closed = closedCount > Math.max(50, prev.length * 0.05) ? [] : changes.filter(c => c.type === 'closed').map(c => c.mover);
  const reasons = closed.length ? await explainClosures(closed) : new Map();
  const events = changes.filter(c => c.type !== 'closed').map(c => eventFrom(c.type, c.mover, { from: c.from, to: c.to }))
    .concat(closed.map(m => { const r = reasons.get(m.dot); return eventFrom('closed', m, { reason: r?.reason, effectiveDate: r?.date || today(), confidence: r?.confidence }); }));
  await save(events);
  return events.length;
}

/**
 * One-time per state: movers that filed in the last ~18 months and are now
 * inactive, with the reason and date of closing.
 */
export async function backfillClosures(state: string) {
  const since = new Date(Date.now() - 540 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const qs = new URLSearchParams({ $where: `phy_state='${state}' AND crgo_household='X' AND status_code!='A' AND mcs150_date>='${since}'`, $limit: '3000' });
  const res = await fetch(`https://data.transportation.gov/resource/az4n-8mr2.json?${qs}`, { signal: AbortSignal.timeout(30_000), headers: sodaHeaders() });
  if (!res.ok) throw new Error(`DOT open data answered ${res.status}`);
  const movers = ((await res.json()) as CensusRow[]).map(r => toMover(r, undefined, zipLookup)).filter(m => m.moverScore >= 40); // For-hire and mostly household goods (no authority data once closed).
  if (!movers.length) return 0;
  const reasons = await explainClosures(movers);
  await save(movers.map(m => { const r = reasons.get(m.dot)!; return eventFrom('closed', m, { reason: r.reason, effectiveDate: r.date, confidence: r.confidence, day: r.date || m.updated || today() }); }));
  return movers.length;
}

/** Recent events, newest first, optionally limited to states and types. */
export async function listEvents(opts: { sinceDay: string; states?: string[]; types?: ChangeType[]; limit?: number }) {
  const snap = await adminDb().collection('registryEvents').where('day', '>=', opts.sinceDay).orderBy('day', 'desc').limit(5000).get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as MarketEvent) }))
    .filter(e => (!opts.states?.length || opts.states.includes(e.state)) && (!opts.types?.length || opts.types.includes(e.type)))
    .slice(0, opts.limit || 1000);
}
