/**
 * Market intelligence on top of the mover registry: what changed (new,
 * closed, grew, shrank), where to expand, who to recruit or buy, and the
 * public "check a mover" verdict. Pure logic (no imports) for unit tests.
 */
import type { Mover } from './registry';

export const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72',
};
export const countyKey = (state: string, county3: string) => (STATE_FIPS[state] && /^\d{3}$/.test(county3) ? `${STATE_FIPS[state]}${county3}` : '');

/** Last 5-digit ZIP in an address ("123 Main St, San Jose, CA 95112" → "95112"). */
export const zipOf = (text: unknown) => { const all = String(text || '').match(/\b\d{5}(?:-\d{4})?\b/g); return all ? all[all.length - 1].slice(0, 5) : ''; };

export function milesBetween(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180, R = 3958.8;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** ZIP codes within `miles` of a point, nearest first. */
export function zipsWithin(center: [number, number], miles: number, zips: Record<string, [number, number]>, max = 300): string[] {
  return Object.entries(zips).map(([z, ll]) => [z, milesBetween(center, ll)] as const).filter(([, d]) => d <= miles).sort((a, b) => a[1] - b[1]).slice(0, max).map(([z]) => z);
}

// ---- What changed between two daily snapshots of a state -------------------

export type ChangeType = 'new' | 'closed' | 'grew' | 'shrank';
export type Change = { type: ChangeType; mover: Mover; from?: number; to?: number };

/**
 * Compares yesterday's and today's lists. Only likely movers count.
 * "closed" here means "no longer an active household-goods carrier"; the
 * reason (revocation, insurance cancelled, inactive) is looked up afterwards.
 */
export function diffMovers(prev: Mover[], next: Mover[]): Change[] {
  const before = new Map(prev.map(m => [m.dot, m])), after = new Map(next.map(m => [m.dot, m]));
  const out: Change[] = [];
  for (const m of next) {
    const p = before.get(m.dot);
    if (!p) { if (m.likelyMover) out.push({ type: 'new', mover: m }); continue; }
    if (!m.likelyMover && !p.likelyMover) continue;
    const d = m.units - p.units;
    if (Math.abs(d) >= 2 && Math.abs(d) >= Math.max(1, p.units) * 0.2) out.push({ type: d > 0 ? 'grew' : 'shrank', mover: m, from: p.units, to: m.units });
  }
  for (const p of prev) if (!after.has(p.dot) && p.likelyMover) out.push({ type: 'closed', mover: p });
  return out;
}

/** "02/10/2026" → "2026-02-10" (FMCSA dates). */
export const mdy = (v: unknown) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim()); return m ? `${m[3]}-${m[1]}-${m[2]}` : ''; };

export type ClosureEvidence = { status?: string; revocations: { type: string; date: string; license: string }[]; insuranceCancelled: { date: string; insurer: string; kind: string }[]; lastFiling?: string };

/** Best explanation for a mover leaving the active list. */
export function closureReason(e: ClosureEvidence): { reason: string; date: string; confidence: 'confirmed' | 'likely' | 'unclear' } {
  const latest = <T extends { date: string }>(xs: T[]) => [...xs].filter(x => x.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const rev = latest(e.revocations), ins = latest(e.insuranceCancelled);
  if (rev && (!ins || rev.date >= ins.date)) return { reason: `Operating authority ${rev.type.toLowerCase()}`, date: rev.date, confidence: 'confirmed' };
  if (ins) return { reason: `Insurance cancelled (${ins.kind || 'liability'}${ins.insurer ? `, ${ins.insurer}` : ''})`, date: ins.date, confidence: 'confirmed' };
  if (e.status === 'I') return { reason: 'USDOT number made inactive', date: e.lastFiling || '', confidence: 'likely' };
  return { reason: 'No longer listed as an active household-goods carrier', date: e.lastFiling || '', confidence: 'unclear' };
}

// ---- Where to expand ------------------------------------------------------------

export type CountyRow = { fips: string; name: string; state: string; population: number; movers: number; trucks: number; quotes: number; bookings: number };

/**
 * Opportunity per county: people per mover (less competition), plus our own
 * demand there (quote requests, bookings). Higher is better.
 */
export function expansionScore(c: CountyRow): number {
  if (c.population < 20000) return 0;
  const perMover = c.population / Math.max(c.movers, 1);           // residents per moving company
  const supply = Math.min(perMover / 10000, 5);                      // 0–5: under-served markets score high
  const size = Math.log10(c.population / 20000 + 1) * 2;             // bigger markets matter more
  const demand = Math.min(Math.log2(c.quotes + 1), 6) + Math.min(c.bookings, 5);
  return Math.round((supply * 2 + size + demand) * 10) / 10;
}
export const moversPer10k = (c: Pick<CountyRow, 'population' | 'movers'>) => (c.population ? Math.round((c.movers / c.population) * 100000) / 10 : 0);

// ---- Who to recruit, who to buy --------------------------------------------------

/** Established local movers: the agent-network sweet spot. */
export const isRecruitCandidate = (m: Mover, years: number) => m.likelyMover && m.hhgAuth && m.units >= 5 && m.units <= 30 && years >= 10;

/**
 * Small, long-running movers whose federal filing has gone stale: often an
 * owner thinking about retiring. 0-100.
 */
export function acquisitionScore(m: Mover, years: number, now = Date.now()): number {
  if (!m.likelyMover || years < 12 || m.units < 1 || m.units > 25) return 0;
  const staleYears = m.updated ? (now - Date.parse(`${m.updated}T00:00:00Z`)) / (365.25 * 86400000) : 5;
  let s = Math.min(years, 40) * 1.2;                  // long history = brand, customers, referrals
  s += Math.min(staleYears, 4) * 8;                   // filings not kept up
  if (m.hhgAuth) s += 10;                             // interstate authority transfers value
  if (m.units >= 3 && m.units <= 12) s += 8;          // affordable, real fleet
  if (/\b(SONS?|BROS|BROTHERS|FAMILY)\b/.test(`${m.name} ${m.dba}`.toUpperCase())) s += 5;
  return Math.max(0, Math.min(100, Math.round(s)));
}

// ---- Public "check a mover" verdict ---------------------------------------------

export type CheckFacts = {
  status: string; interstate: boolean; hhgAuthority: boolean | null; commonActive: boolean | null; brokerActive: boolean | null;
  liabilityOnFile: number | null; cargoOnFile: number | null; revokedOn: string | null; years: number; safety: string; state: string; units: number;
};
export type Verdict = { level: 'good' | 'caution' | 'bad'; headline: string; checks: { ok: boolean | null; text: string }[]; notes: string[] };

export function moverVerdict(f: CheckFacts): Verdict {
  const checks: Verdict['checks'] = [];
  const notes: string[] = [];
  const active = f.status === 'A';
  checks.push({ ok: active, text: active ? 'Registered and active with the U.S. Department of Transportation' : 'USDOT registration is not active' });
  if (f.interstate) {
    checks.push({ ok: !!f.hhgAuthority && !!f.commonActive, text: f.hhgAuthority && f.commonActive ? 'Authorized by FMCSA to move household goods across state lines' : 'No active FMCSA authority to move household goods across state lines' });
    checks.push({ ok: f.liabilityOnFile !== null && f.liabilityOnFile > 0, text: f.liabilityOnFile ? `Liability insurance on file ($${f.liabilityOnFile.toLocaleString()})` : 'No active liability insurance on file with FMCSA' });
    checks.push({ ok: f.cargoOnFile !== null && f.cargoOnFile > 0 ? true : null, text: f.cargoOnFile ? `Cargo insurance on file ($${f.cargoOnFile.toLocaleString()})` : 'No cargo insurance filing found (ask for proof of coverage for your belongings)' });
  } else {
    checks.push({ ok: null, text: 'Registered for in-state moves only: also check the state’s moving license' });
    if (f.state === 'CA') notes.push('California movers must hold a CPUC household goods permit (a “CAL-T” number). Check it on the CPUC website before you book.');
    if (f.state === 'WA') notes.push('Washington movers must hold a household goods permit from the Utilities and Transportation Commission (UTC).');
  }
  if (f.brokerActive && !f.commonActive) { checks.push({ ok: false, text: 'Licensed as a broker: they arrange moves but don’t do them; another company will handle your belongings' }); }
  if (f.revokedOn) checks.push({ ok: false, text: `Operating authority revoked on ${f.revokedOn}` });
  checks.push({ ok: f.years >= 3 ? true : null, text: f.years ? `${f.years} year${f.years === 1 ? '' : 's'} registered with the DOT` : 'Newly registered' });
  if (f.safety === 'U') checks.push({ ok: false, text: 'Unsatisfactory federal safety rating' });
  else if (f.safety === 'C') checks.push({ ok: null, text: 'Conditional federal safety rating' });
  else if (f.safety === 'S') checks.push({ ok: true, text: 'Satisfactory federal safety rating' });

  const bad = !active || !!f.revokedOn || f.safety === 'U' || (f.interstate && (!f.commonActive || !f.liabilityOnFile) && !f.brokerActive);
  const caution = !bad && (checks.some(c => c.ok === false) || (f.brokerActive && !f.commonActive) || f.years < 2);
  const level = bad ? 'bad' : caution ? 'caution' : 'good';
  const headline = level === 'good' ? 'This mover’s federal registration checks out' : level === 'caution' ? 'Some things need a closer look' : 'Red flags: we’d think twice before booking';
  notes.push('Federal records show licensing and insurance, not service quality. Read recent reviews and get a written estimate.');
  return { level, headline, checks, notes };
}
