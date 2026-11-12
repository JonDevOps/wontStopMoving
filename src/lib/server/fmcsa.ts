import { mdy } from '@/lib/market';
import { politeFetch } from './soda-token';

/**
 * Live lookups against free FMCSA open data (data.transportation.gov):
 * company census, operating authority, active insurance, insurance history
 * and revocations. Results are cached in memory for 10 minutes.
 */
const BASE = 'https://data.transportation.gov/resource';
const DS = { census: 'az4n-8mr2', authority: '6eyk-hxee', activeInsurance: 'qh9u-swkp', insuranceHistory: '6sqe-dvqs', revocations: 'sa6p-acbp', inspections: 'fx4q-ay7w', crashes: 'aayw-vxb3' };
const cache = new Map<string, { at: number; value: unknown }>();

async function soda<T>(ds: keyof typeof DS, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  const key = `${ds}?${qs}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value as T[];
  const res = await politeFetch(`${BASE}/${DS[ds]}.json?${qs}`, 15_000, 3_000);
  if (!res.ok) throw new Error(`FMCSA data answered ${res.status}`);
  const value = await res.json() as T[];
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}

const pad8 = (dot: string) => String(Number(dot)).padStart(8, '0');
const inList = (dots: string[]) => dots.map(d => `'${pad8(d)}'`).join(',');
const quote = (s: string) => s.replace(/'/g, "''");

export type CensusRecord = Record<string, string>;

/** Full-text search of the census (any status). */
export async function searchCensus(q: string, state?: string, limit = 20): Promise<CensusRecord[]> {
  const where = [`crgo_household='X'`, state ? `phy_state='${quote(state)}'` : ''].filter(Boolean).join(' AND ');
  return soda<CensusRecord>('census', { $q: q.slice(0, 80), $where: where, $limit: String(limit), $order: 'status_code, power_units DESC' });
}

export async function censusByDots(dots: string[]): Promise<CensusRecord[]> {
  if (!dots.length) return [];
  const out: CensusRecord[] = [];
  for (let i = 0; i < dots.length; i += 150) out.push(...await soda<CensusRecord>('census', { $where: `dot_number in(${dots.slice(i, i + 150).map(d => `'${Number(d)}'`).join(',')})`, $limit: '1000' }));
  return out;
}

export type Authority = { mc: string; common: boolean; contract: boolean; broker: boolean; hhg: boolean; pendingRevocation: boolean };
export async function authorityFor(dot: string): Promise<Authority[]> {
  const rows = await soda<Record<string, string>>('authority', { $where: `dot_number='${pad8(dot)}'`, $limit: '20' });
  return rows.map(r => ({ mc: r.docket_number || '', common: r.common_stat === 'A', contract: r.contract_stat === 'A', broker: r.broker_stat === 'A', hhg: r.hhg_chk === 'Y', pendingRevocation: r.common_rev_pend === 'Y' || r.contract_rev_pend === 'Y' || r.broker_rev_pend === 'Y' }));
}

export type Policy = { kind: string; insurer: string; policy: string; coverage: number; effective: string; cancels: string };
/** Insurance currently on file (active or pending), by DOT number. */
export async function activeInsuranceFor(dot: string): Promise<Policy[]> {
  const rows = await soda<Record<string, string>>('activeInsurance', { $where: `dot_number='${pad8(dot)}'`, $limit: '30' });
  return rows.map(r => ({ kind: r.mod_col_1 || '', insurer: r.name_company || '', policy: r.policy_no || '', coverage: Number(r.max_cov_amount || 0) * 1000, effective: mdy(r.effective_date), cancels: mdy(r.cancl_effective_date) }));
}

/** Coverage totals from active filings: liability (BIPD) and cargo. */
export function coverageTotals(policies: Policy[], today = new Date().toISOString().slice(0, 10)) {
  const live = policies.filter(p => !p.cancels || p.cancels > today);
  const sum = (re: RegExp) => live.filter(p => re.test(p.kind)).reduce((n, p) => Math.max(n, p.coverage), 0);
  return { liability: sum(/BIPD/i), cargo: sum(/CARGO/i), bond: sum(/SURETY|BOND|TRUST/i) };
}

export async function revocationsFor(dots: string[]): Promise<Map<string, { type: string; date: string; license: string }[]>> {
  const out = new Map<string, { type: string; date: string; license: string }[]>();
  for (let i = 0; i < dots.length; i += 150) {
    const rows = await soda<Record<string, string>>('revocations', { $where: `dot_number in(${inList(dots.slice(i, i + 150))})`, $limit: '2000' });
    for (const r of rows) {
      const dot = String(Number(r.dot_number));
      out.set(dot, [...(out.get(dot) || []), { type: r.order2_type_desc || 'Revocation', date: mdy(r.order2_effective_date) || mdy(r.order1_serve_date), license: r.type_license || '' }]);
    }
  }
  return out;
}

export async function insuranceCancellationsFor(dots: string[]): Promise<Map<string, { date: string; insurer: string; kind: string }[]>> {
  const out = new Map<string, { date: string; insurer: string; kind: string }[]>();
  for (let i = 0; i < dots.length; i += 150) {
    const rows = await soda<Record<string, string>>('insuranceHistory', { $where: `dot_number in(${inList(dots.slice(i, i + 150))}) AND mod_col_1='Cancelled'`, $limit: '3000' });
    for (const r of rows) {
      const dot = String(Number(r.dot_number));
      out.set(dot, [...(out.get(dot) || []), { date: mdy(r.cancl_effective_date), insurer: r.name_company || '', kind: r.mod_col_3 || '' }]);
    }
  }
  return out;
}

const ymd = (v: unknown) => { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v || '').trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
const since = (months: number) => new Date(Date.now() - months * 30.44 * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');

/** Roadside inspections in the last 24 months (vehicle inspection file; DOT number unpadded). */
export async function inspectionsFor(dot: string) {
  const rows = await soda<Record<string, string>>('inspections', { $select: 'insp_date,report_state,insp_level_id,viol_total,oos_total,vehicle_oos_total,driver_oos_total', $where: `dot_number='${Number(dot)}' AND insp_date>='${since(24)}'`, $limit: '3000' });
  return rows.map(r => ({ date: ymd(r.insp_date), state: r.report_state || '', level: r.insp_level_id || '', violations: Number(r.viol_total || 0), oos: Number(r.oos_total || 0), vehicleOos: Number(r.vehicle_oos_total || 0), driverOos: Number(r.driver_oos_total || 0) }));
}

/** Crashes reported in the last 24 months. */
export async function crashesFor(dot: string) {
  const rows = await soda<Record<string, string>>('crashes', { $select: 'report_date,state,fatalities,injuries,tow_away', $where: `dot_number='${Number(dot)}' AND report_date>='${since(24)}'`, $limit: '1000' });
  return rows.map(r => ({ date: ymd(r.report_date), state: r.state || '', fatalities: Number(r.fatalities || 0), injuries: Number(r.injuries || 0), towAway: r.tow_away === 'Y' }));
}
