/**
 * Activity, safety and trouble signals from free FMCSA data: roadside
 * inspections, crashes, insurance cancellations and revocations (last 24
 * months). Pure helpers; fetching lives in src/lib/server/safety.ts.
 */
export type Inspection = { date: string; state: string; level: string; violations: number; oos: number; vehicleOos: number; driverOos: number };
export type Crash = { date: string; state: string; fatalities: number; injuries: number; towAway: boolean };
export type Trouble = { kind: 'insurance-cancelled' | 'insurance-cancelling' | 'revoked' | 'revocation-pending'; date: string; text: string };

/** Approximate national out-of-service rates for all carriers (FMCSA roadside inspection results). */
export const NATIONAL_OOS = { vehicle: 0.22, driver: 0.06 } as const;
const VEHICLE_LEVELS = new Set(['1', '2', '5', '6']);
const DRIVER_LEVELS = new Set(['1', '2', '3', '6']);

export type Safety = {
  inspections: number; last12: number; prev12: number; trend: 'growing' | 'shrinking' | 'steady' | null; trendPct: number | null;
  perTruckYear: number | null; vehicleOosRate: number | null; driverOosRate: number | null; lastInspection: string | null;
  states: { state: string; count: number }[]; crashes: number; injuries: number; fatalities: number; crashesPer10TrucksYear: number | null;
  trouble: Trouble[]; score: number | null; grade: 'A' | 'B' | 'C' | 'D' | null; signals: string[];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const daysAgo = (d: string, now: number) => (now - Date.parse(d)) / 86400_000;

/**
 * Safety score, 0-100 (needs 3+ inspections): starts at 100 and loses points for
 * vehicle and driver out-of-service rates above the national rates, crashes per
 * truck, and fatal crashes. A = 85+, B = 70+, C = 50+, D below.
 */
export const SAFETY_HELP = 'Safety score starts at 100 and loses points for vehicle and driver out-of-service rates above the national rates (about 22% and 6%), crashes per truck, and fatal crashes. A = 85+, B = 70+, C = 50+, D below. Needs 3+ inspections in 24 months.';

export function summarizeSafety(input: { inspections: Inspection[]; crashes: Crash[]; trouble: Trouble[]; units: number; homeState: string }, now = Date.now()): Safety {
  const ins = input.inspections.filter(i => !Number.isNaN(Date.parse(i.date)) && daysAgo(i.date, now) <= 730);
  const crashes = input.crashes.filter(c => !Number.isNaN(Date.parse(c.date)) && daysAgo(c.date, now) <= 730);
  const last12 = ins.filter(i => daysAgo(i.date, now) <= 365).length, prev12 = ins.length - last12;
  const trendPct = prev12 >= 3 ? Math.round(((last12 - prev12) / prev12) * 100) : null;
  const trend = last12 + prev12 < 6 || trendPct === null ? null : trendPct >= 20 ? 'growing' : trendPct <= -20 ? 'shrinking' : 'steady';
  const veh = ins.filter(i => VEHICLE_LEVELS.has(i.level)), drv = ins.filter(i => DRIVER_LEVELS.has(i.level));
  const vehicleOosRate = veh.length >= 3 ? veh.filter(i => i.vehicleOos > 0).length / veh.length : null;
  const driverOosRate = drv.length >= 3 ? drv.filter(i => i.driverOos > 0).length / drv.length : null;
  const byState = new Map<string, number>();
  for (const i of ins) if (i.state) byState.set(i.state, (byState.get(i.state) || 0) + 1);
  const states = [...byState.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([state, count]) => ({ state, count })); // Objects: Firestore can't store nested arrays.
  const injuries = crashes.reduce((n, c) => n + c.injuries, 0), fatalities = crashes.reduce((n, c) => n + c.fatalities, 0);
  const units = Math.max(1, input.units || 0);
  const crashesPer10TrucksYear = input.units ? Math.round((crashes.length / 2 / units) * 10 * 100) / 100 : null;

  let score: number | null = null;
  if (ins.length >= 3) {
    score = 100;
    if (vehicleOosRate !== null) score -= Math.max(0, vehicleOosRate - NATIONAL_OOS.vehicle) * 150;
    if (driverOosRate !== null) score -= Math.max(0, driverOosRate - NATIONAL_OOS.driver) * 300;
    score -= Math.min(30, (crashes.length / 2 / units) * 10 * 10);
    score -= Math.min(30, crashes.filter(c => c.fatalities > 0).length * 10);
    score = Math.max(0, Math.min(100, Math.round(score)));
  }
  const grade = score === null ? null : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

  const signals: string[] = [];
  if (trend === 'growing') signals.push(`Busier: ${last12} inspections in the last 12 months vs ${prev12} the year before (+${trendPct}%).`);
  if (trend === 'shrinking') signals.push(`Slowing down: ${last12} inspections in the last 12 months vs ${prev12} the year before (${trendPct}%).`);
  if (vehicleOosRate !== null && vehicleOosRate > NATIONAL_OOS.vehicle * 1.25) signals.push(`Trucks fail inspections often: ${pct(vehicleOosRate)} put out of service (national about ${pct(NATIONAL_OOS.vehicle)}).`);
  if (driverOosRate !== null && driverOosRate > NATIONAL_OOS.driver * 1.5) signals.push(`Drivers put out of service ${pct(driverOosRate)} of the time (national about ${pct(NATIONAL_OOS.driver)}).`);
  if (fatalities) signals.push(`${fatalities} death${fatalities === 1 ? '' : 's'} in crashes in the last 24 months.`);
  const away = states.filter(s => s.state !== input.homeState);
  if (ins.length >= 5 && away.length) {
    const share = away.reduce((n, s) => n + s.count, 0) / ins.length;
    if (share >= 0.3) signals.push(`Works far from home: ${pct(share)} of inspections outside ${input.homeState} (${away.slice(0, 3).map(s => s.state).join(', ')}).`);
  }
  for (const t of input.trouble) signals.push(t.text);
  if (!ins.length && !crashes.length) signals.push('No roadside inspections or crashes in 24 months: little or no interstate road activity on record.');

  return {
    inspections: ins.length, last12, prev12, trend, trendPct, perTruckYear: input.units ? Math.round((last12 / units) * 10) / 10 : null,
    vehicleOosRate: vehicleOosRate === null ? null : Math.round(vehicleOosRate * 1000) / 1000, driverOosRate: driverOosRate === null ? null : Math.round(driverOosRate * 1000) / 1000,
    lastInspection: ins.map(i => i.date).sort().pop() || null, states, crashes: crashes.length, injuries, fatalities, crashesPer10TrucksYear,
    trouble: input.trouble, score, grade, signals,
  };
}

/** Recent trouble only: cancellations in the last 12 months (or coming up), revocations in the last 3 years (or pending). */
export function recentTrouble(input: { cancellations: { date: string; insurer: string; kind: string }[]; upcomingCancellations: { date: string; insurer: string; kind: string }[]; revocations: { type: string; date: string; license: string }[]; pendingRevocation: boolean }, now = Date.now()): Trouble[] {
  const out: Trouble[] = [];
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  for (const c of input.upcomingCancellations) out.push({ kind: 'insurance-cancelling', date: c.date, text: `Insurance is set to cancel on ${fmt(c.date)}${c.insurer ? ` (${c.insurer})` : ''}${c.kind ? `, ${c.kind}` : ''}.` });
  for (const c of input.cancellations.filter(c => c.date && daysAgo(c.date, now) >= 0 && daysAgo(c.date, now) <= 365)) out.push({ kind: 'insurance-cancelled', date: c.date, text: `Insurance cancelled ${fmt(c.date)}${c.insurer ? ` (${c.insurer})` : ''}${c.kind ? `, ${c.kind}` : ''}.` });
  for (const r of input.revocations.filter(r => r.date && daysAgo(r.date, now) >= 0 && daysAgo(r.date, now) <= 3 * 365)) out.push({ kind: 'revoked', date: r.date, text: `${r.license ? `${r.license[0]}${r.license.slice(1).toLowerCase()} authority` : 'Authority'}: ${r.type.toLowerCase()} on ${fmt(r.date)}.` });
  if (input.pendingRevocation) out.push({ kind: 'revocation-pending', date: '', text: 'FMCSA has a revocation of their operating authority pending.' });
  // Same cancellation can appear more than once (one per filing): keep one per day and kind.
  const seen = new Set<string>();
  return out.filter(t => { const k = `${t.kind}|${t.date}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (b.date || '9').localeCompare(a.date || '9'));
}
