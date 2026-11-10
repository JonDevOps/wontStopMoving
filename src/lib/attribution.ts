/**
 * Lead source attribution. The site records where a visitor first came from
 * (ad tags, referring site, referral link) and saves it with their quote, so
 * the lead inbox can show bookings and revenue per marketing channel.
 * Pure logic (no imports) so it can be unit-tested directly.
 */
export type LeadSource = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
  referrerHost?: string; landingPath?: string; refCode?: string; firstSeenAt?: number;
};

export type Channel = 'Referral' | 'Paid search' | 'Paid social' | 'Organic search' | 'Social' | 'Email' | 'Other website' | 'Direct';
export const CHANNELS: Channel[] = ['Referral', 'Paid search', 'Paid social', 'Organic search', 'Social', 'Email', 'Other website', 'Direct'];

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|tiktok|twitter|x|t|linkedin|pinterest|reddit|youtube|nextdoor|threads)\.(com|co|net)$/;
const SELF = /(^|\.)wontstopmoving\.com$/;

export function classifyChannel(s: LeadSource | null | undefined): Channel {
  if (!s) return 'Direct';
  if (s.refCode) return 'Referral';
  const medium = (s.utmMedium || '').toLowerCase(), source = (s.utmSource || '').toLowerCase();
  if (/^(cpc|ppc|paid|paidsearch|paid_search|sem)$/.test(medium)) return /facebook|instagram|meta|tiktok|linkedin|twitter|x|social/.test(source) ? 'Paid social' : 'Paid search';
  if (/^(paid_social|paidsocial|social_paid)$/.test(medium)) return 'Paid social';
  if (/^(email|newsletter)$/.test(medium) || source === 'email') return 'Email';
  if (/^(social|social-network|social_media)$/.test(medium)) return 'Social';
  if (/^(referral|affiliate|partner)$/.test(medium)) return 'Other website';
  const host = (s.referrerHost || '').toLowerCase();
  if (host && !SELF.test(host)) {
    if (SEARCH.test(host)) return 'Organic search';
    if (SOCIAL.test(host)) return 'Social';
    return 'Other website';
  }
  if (source) return /google|bing|yahoo/.test(source) ? 'Organic search' : 'Other website';
  return 'Direct';
}

/** Trims and bounds a stored source so a quote can't carry arbitrary data. */
export function cleanLeadSource(raw: unknown): LeadSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max = 100) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
  const out: LeadSource = {
    utmSource: str(r.utmSource), utmMedium: str(r.utmMedium), utmCampaign: str(r.utmCampaign),
    referrerHost: str(r.referrerHost, 120), landingPath: str(r.landingPath, 200),
    refCode: typeof r.refCode === 'string' && /^[A-Z0-9]{6,12}$/.test(r.refCode) ? r.refCode : undefined,
    firstSeenAt: typeof r.firstSeenAt === 'number' && Number.isFinite(r.firstSeenAt) ? r.firstSeenAt : undefined,
  };
  for (const k of Object.keys(out) as (keyof LeadSource)[]) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : null;
}
