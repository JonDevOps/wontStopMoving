export const SMS_DISCLOSURE_VERSION = '2026-11-18';
export const SMS_PURPOSE = 'informational_moving';
export const SMS_DISCLOSURE = 'By checking this box, you agree to receive recurring informational text messages from WontStopMoving about moving estimates, booking confirmations and payment codes, appointment reminders, moving-day updates, customer support, and a review invitation after your move. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance. Consent is not a condition of purchase or receiving moving services.';
export const PROVIDER_SMS_DISCLOSURE = 'By checking this box, you agree to receive recurring informational text messages from WontStopMoving about new jobs, appointments, job updates, accepted payment codes and payout status. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance. Consent is not a condition of providing services. Job information remains available by email and in your dashboard.';

/** US/Canada numbers may be entered in familiar local format; other countries need +country code. */
export function normalizeSmsPhone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40 || /[^\d\s()+.\-]/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  const phone = value.trim().startsWith('+') ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : '';
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

/** Consent evidence never contains query strings, fragments, payment IDs or access tokens. */
export function smsSourcePage(value: unknown, fallback = '/sms'): string {
  try {
    const url = new URL(typeof value === 'string' ? value : fallback, 'https://wontstopmoving.com');
    if (url.origin !== 'https://wontstopmoving.com' || url.pathname.length > 300) return `https://wontstopmoving.com${fallback}`;
    return `${url.origin}${url.pathname}`;
  } catch { return `https://wontstopmoving.com${fallback}`; }
}
