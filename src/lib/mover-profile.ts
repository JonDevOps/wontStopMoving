/**
 * Mover credentials profile: license, insurance and background check, kept up
 * to date by the mover in providerCompliance/{uid} (server-only, since
 * providers/{uid} is public). Pure checks shared by the API, the mover's page
 * and the admin list.
 */
export const BACKGROUND_STATUSES = {
  'not-started': 'Not started',
  consented: 'Consent given: check being ordered',
  pending: 'In progress',
  clear: 'Clear',
  review: 'Needs review',
} as const;
export type BackgroundStatus = keyof typeof BACKGROUND_STATUSES;
export const isBackgroundStatus = (v: unknown): v is BackgroundStatus => typeof v === 'string' && v in BACKGROUND_STATUSES;

export type MoverProfile = {
  usdot: string; mcNumber: string; stateLicense: string;
  insuranceCarrier: string; policyNumber: string; insuranceExpires: string; // YYYY-MM-DD
  cargoCoverage: number | null; liabilityCoverage: number | null;
  backgroundStatus: BackgroundStatus; backgroundConsentAt?: string | null;
  fmcsa?: { checkedAt: string; hhgAuthority: boolean; activeAuthority: boolean; insuranceOnFile: boolean } | null;
};

export const EMPTY_PROFILE: MoverProfile = {
  usdot: '', mcNumber: '', stateLicense: '', insuranceCarrier: '', policyNumber: '', insuranceExpires: '',
  cargoCoverage: null, liabilityCoverage: null, backgroundStatus: 'not-started', fmcsa: null,
};

export const EXPIRY_WARNING_DAYS = 30;
const DAY = 86400000;

export function daysUntil(date: string, now = Date.now()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return Math.floor((Date.parse(`${date}T23:59:59Z`) - now) / DAY);
}

export type Issue = { field: string; message: string; blocking: boolean };

/** What's missing or expiring. Blocking issues should pause new job assignments. */
export function profileIssues(p: MoverProfile, opts: { needsDot: boolean }, now = Date.now()): Issue[] {
  const out: Issue[] = [];
  if (opts.needsDot && !p.usdot) out.push({ field: 'usdot', message: 'Add your USDOT number.', blocking: true });
  if (p.usdot && p.fmcsa && !p.fmcsa.activeAuthority && p.mcNumber) out.push({ field: 'mcNumber', message: 'FMCSA shows no active operating authority for your MC number.', blocking: true });
  if (!p.insuranceCarrier || !p.policyNumber) out.push({ field: 'insurance', message: 'Add your insurance company and policy number.', blocking: true });
  const days = daysUntil(p.insuranceExpires, now);
  if (days === null) out.push({ field: 'insuranceExpires', message: 'Add your insurance expiration date.', blocking: true });
  else if (days < 0) out.push({ field: 'insuranceExpires', message: 'Your insurance has expired. Upload your renewal.', blocking: true });
  else if (days <= EXPIRY_WARNING_DAYS) out.push({ field: 'insuranceExpires', message: `Your insurance expires in ${days} day${days === 1 ? '' : 's'}.`, blocking: false });
  if (p.backgroundStatus === 'not-started') out.push({ field: 'background', message: 'Give consent for your background check.', blocking: true });
  else if (p.backgroundStatus === 'review') out.push({ field: 'background', message: 'Your background check needs review. Our team will contact you.', blocking: true });
  return out;
}

const digits = (v: unknown, max: number) => String(v ?? '').replace(/\D/g, '').slice(0, max);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v: unknown) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) || n < 0 ? null : Math.min(Math.round(n), 100_000_000); };

/** The fields a mover may edit (never the background result or FMCSA check). */
export function cleanProfileInput(raw: Record<string, unknown>) {
  const exp = text(raw.insuranceExpires, 10);
  return {
    usdot: digits(raw.usdot, 10), mcNumber: digits(raw.mcNumber, 10), stateLicense: text(raw.stateLicense, 60),
    insuranceCarrier: text(raw.insuranceCarrier, 120), policyNumber: text(raw.policyNumber, 60),
    insuranceExpires: /^\d{4}-\d{2}-\d{2}$/.test(exp) && !Number.isNaN(Date.parse(exp)) ? exp : '',
    cargoCoverage: money(raw.cargoCoverage), liabilityCoverage: money(raw.liabilityCoverage),
  };
}
