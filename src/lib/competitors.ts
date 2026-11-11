/**
 * Competitor tracker: the scoreboard logic. Each competitor is compared with
 * our own numbers on the same metrics; we "pass" a competitor when we beat
 * them on every metric both sides have (and at least two are known).
 * Phase 1 is the main list (up to ~300 challengers). Once they are all
 * passed, Phase 2 is the "legends" list of companies better than them.
 * Pure logic (no imports) so it can be unit-tested directly.
 */

export type MetricKey =
  | 'revenueUsd' | 'googleReviews' | 'googleRating' | 'followers' | 'postsPerMonth'
  | 'avgPostLikes' | 'customersPerYear' | 'repeatRate';

export type Metrics = Partial<Record<MetricKey, number>>;

export const METRICS: { key: MetricKey; label: string; hint: string; format: 'money' | 'number' | 'rating' | 'percent' }[] = [
  { key: 'revenueUsd', label: 'Yearly revenue', hint: 'Estimated, in dollars', format: 'money' },
  { key: 'googleReviews', label: 'Google reviews', hint: 'Total review count', format: 'number' },
  { key: 'googleRating', label: 'Google rating', hint: '1 to 5 stars', format: 'rating' },
  { key: 'followers', label: 'Social followers', hint: 'All platforms combined', format: 'number' },
  { key: 'postsPerMonth', label: 'Posts per month', hint: 'Across social platforms', format: 'number' },
  { key: 'avgPostLikes', label: 'Likes per post', hint: 'Average engagement', format: 'number' },
  { key: 'customersPerYear', label: 'Customers per year', hint: 'Moves or jobs', format: 'number' },
  { key: 'repeatRate', label: 'Repeat customers', hint: 'Percent who book again', format: 'percent' },
];

export type Tier = 'challenger' | 'legend';
export type Standing = 'ahead' | 'behind' | 'tied' | 'unknown';

const known = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Per-metric comparison of us against one competitor. */
export function compareToUs(us: Metrics, them: Metrics): Record<MetricKey, Standing> {
  const out = {} as Record<MetricKey, Standing>;
  for (const { key } of METRICS) {
    const a = us[key], b = them[key];
    out[key] = !known(a) || !known(b) ? 'unknown' : a > b ? 'ahead' : a < b ? 'behind' : 'tied';
  }
  return out;
}

export type Scoreboard = { ahead: number; behind: number; tied: number; known: number; passed: boolean; gap: number };

/**
 * Summary used to sort the list and decide passes. `gap` is how far behind
 * we are, as the sum of each behind metric's shortfall in percent (capped at
 * 100 per metric): a smaller gap means "next to pass".
 */
export function scoreboard(us: Metrics, them: Metrics): Scoreboard {
  const cmp = compareToUs(us, them);
  let ahead = 0, behind = 0, tied = 0, gap = 0;
  for (const { key } of METRICS) {
    const s = cmp[key];
    if (s === 'ahead') ahead++;
    else if (s === 'tied') tied++;
    else if (s === 'behind') {
      behind++;
      const a = us[key] as number, b = them[key] as number;
      gap += Math.min(100, b > 0 ? ((b - a) / b) * 100 : 100);
    }
  }
  const knownCount = ahead + behind + tied;
  return { ahead, behind, tied, known: knownCount, passed: knownCount >= 2 && behind === 0 && ahead >= 1, gap: Math.round(gap) };
}

/** Clean a metrics object from a request: known keys, finite non-negative numbers only. */
export function cleanMetrics(raw: unknown): Metrics {
  const out: Metrics = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const { key, format } of METRICS) {
    const v = (raw as Record<string, unknown>)[key];
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/[$,%\s]/g, '')) : v;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) continue;
    out[key] = format === 'rating' ? Math.min(5, n) : format === 'percent' ? Math.min(100, n) : Math.min(n, 1e12);
  }
  return out;
}

/**
 * Parses pasted lines into competitors: "Name, website, city/region" per
 * line (website and city optional). Skips blanks, headers and duplicates.
 */
export function parseCompetitorList(text: string, max = 500): { name: string; website: string; location: string }[] {
  const seen = new Set<string>(), out: { name: string; website: string; location: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/\t|,/).map(c => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    const name = cells[0].slice(0, 120);
    if (/^(name|company|business)$/i.test(name)) continue;
    const site = cells.slice(1).find(c => /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(c)) || '';
    const location = cells.slice(1).filter(c => c !== site).join(', ').slice(0, 120);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, website: normalizeWebsite(site), location });
    if (out.length >= max) break;
  }
  return out;
}

/** "acme.com" → "https://acme.com"; anything that isn't a plain web address → "". */
export function normalizeWebsite(raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return '';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}

export type ActionItem = { id: string; text: string; impact: 'high' | 'medium' | 'low'; area: string; done: boolean };
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;
export const sortActions = <T extends Pick<ActionItem, 'impact' | 'done'>>(items: T[]) =>
  [...items].sort((a, b) => Number(a.done) - Number(b.done) || IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
