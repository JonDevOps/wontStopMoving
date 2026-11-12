/**
 * Social media numbers from official APIs (Instagram Business Discovery,
 * YouTube Data API) and how we score them. Pure helpers; fetching lives in
 * src/lib/server/social-stats.ts.
 */
export type Post = { at: string; likes: number | null; comments: number | null; views?: number | null };
export type PlatformStats = {
  platform: 'instagram' | 'youtube'; handle: string; url: string;
  followers: number | null; posts: number | null; sampled: number;
  avgLikes: number | null; avgComments: number | null; avgViews: number | null;
  lastPostAt: string | null; postsLast30: number | null; checkedAt: string; error?: string;
};
export const STATS_PLATFORMS = ['instagram', 'youtube'] as const;

/** Instagram username from a profile link (not a post, reel or explore page). */
export function igUsername(url: string): string | null {
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(url.trim());
  return m && !['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'].includes(m[1].toLowerCase()) ? m[1] : null;
}

/** How to look up a YouTube channel from its link. */
export function ytRef(url: string): { id?: string; handle?: string; username?: string } | null {
  const u = url.trim();
  let m = /youtube\.com\/channel\/(UC[\w-]{22})/i.exec(u); if (m) return { id: m[1] };
  m = /youtube\.com\/@([\w.-]{3,100})/i.exec(u); if (m) return { handle: m[1] };
  m = /youtube\.com\/user\/([\w.-]{1,100})/i.exec(u); if (m) return { username: m[1] };
  m = /youtube\.com\/c\/([\w.-]{1,100})/i.exec(u); if (m) return { handle: m[1] }; // Old custom URLs usually match the handle.
  m = /youtube\.com\/([\w.-]{3,100})\/?(?:[?#].*)?$/i.exec(u); if (m && !['watch', 'playlist', 'results', 'shorts', 'embed', 'feed'].includes(m[1].toLowerCase())) return { handle: m[1] };
  return null;
}

const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

/** Averages and posting rhythm from a sample of recent posts. */
export function summarizePosts(posts: Post[], now = Date.now()) {
  const dated = posts.filter(p => !Number.isNaN(Date.parse(p.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return {
    sampled: dated.length,
    avgLikes: avg(dated.map(p => p.likes)), avgComments: avg(dated.map(p => p.comments)), avgViews: avg(dated.map(p => p.views)),
    lastPostAt: dated[0]?.at ? new Date(dated[0].at).toISOString() : null,
    postsLast30: dated.length ? dated.filter(p => now - Date.parse(p.at) <= 30 * 86400_000).length : null,
  };
}

export type SocialSummary = { followers: number | null; postsLast30: number | null; avgLikes: number | null; lastPostAt: string | null; daysSinceLastPost: number | null; engagementRate: number | null; platforms: number };

/** All platforms together. */
export function combineStats(stats: Partial<Record<string, PlatformStats>>, now = Date.now()): SocialSummary {
  const ok = Object.values(stats).filter((s): s is PlatformStats => !!s && !s.error);
  const sum = (k: 'followers' | 'postsLast30') => ok.some(s => typeof s[k] === 'number') ? ok.reduce((n, s) => n + (s[k] || 0), 0) : null;
  const followers = sum('followers');
  const lastPostAt = ok.map(s => s.lastPostAt).filter((x): x is string => !!x).sort().pop() || null;
  const engaged = ok.filter(s => s.followers && s.avgLikes !== null);
  const engagementRate = engaged.length ? engaged.reduce((n, s) => n + (s.avgLikes || 0) + (s.avgComments || 0), 0) / engaged.reduce((n, s) => n + (s.followers || 0), 0) : null;
  return {
    followers, postsLast30: sum('postsLast30'), avgLikes: avg(ok.map(s => s.avgLikes)), lastPostAt,
    daysSinceLastPost: lastPostAt ? Math.floor((now - Date.parse(lastPostAt)) / 86400_000) : null,
    engagementRate: engagementRate === null ? null : Math.round(engagementRate * 10000) / 10000, platforms: ok.length,
  };
}

/**
 * Social score, 0-100:
 *   40% audience  (followers on a log scale: 100k = full marks),
 *   35% activity  (8+ posts in 30 days, and a post within the last week),
 *   25% engagement (likes + comments per post ÷ followers; 3% = full marks).
 */
export const SOCIAL_SCORE_HELP = 'Score = 40% audience (followers, 100k = full marks) + 35% activity (8+ posts in the last 30 days and a post this week) + 25% engagement (likes and comments per post ÷ followers; 3% = full marks).';
export function socialScore(s: SocialSummary): number | null {
  if (!s.platforms) return null;
  const audience = s.followers ? Math.min(100, (Math.log10(s.followers + 1) / 5) * 100) : 0;
  const recency = s.daysSinceLastPost === null ? 0 : s.daysSinceLastPost <= 7 ? 1 : Math.max(0, 1 - (s.daysSinceLastPost - 7) / 83);
  const activity = Math.min(1, (s.postsLast30 || 0) / 8) * 60 + recency * 40;
  const engagement = s.engagementRate ? Math.min(100, (s.engagementRate / 0.03) * 100) : 0;
  return Math.round(audience * 0.4 + activity * 0.35 + engagement * 0.25);
}

export type Activity = 'active' | 'slowing' | 'inactive' | 'unknown';
export const activityOf = (s: SocialSummary): Activity => s.daysSinceLastPost === null ? 'unknown' : s.daysSinceLastPost <= 14 ? 'active' : s.daysSinceLastPost <= 60 ? 'slowing' : 'inactive';

/** The competitor metrics these numbers fill in. */
export function metricsFromStats(s: SocialSummary): { followers?: number; postsPerMonth?: number; avgPostLikes?: number } {
  return {
    ...(s.followers !== null ? { followers: s.followers } : {}),
    ...(s.postsLast30 !== null ? { postsPerMonth: s.postsLast30 } : {}),
    ...(s.avgLikes !== null ? { avgPostLikes: s.avgLikes } : {}),
  };
}
