import { igUsername, summarizePosts, ytRef, type PlatformStats } from '@/lib/social-stats';

/**
 * Follower, post and engagement numbers from official, free APIs:
 *   - Instagram: Meta's Business Discovery (works for business and creator
 *     accounts). Needs IG_USER_ID (our Instagram business account ID) and
 *     IG_ACCESS_TOKEN (a long-lived token from our Meta app).
 *   - YouTube: YouTube Data API v3 (free daily quota; ~3 units per channel).
 *     Key: YOUTUBE_API_KEY, or the shared GOOGLE_CLOUD_API_KEY.
 * Facebook, TikTok and X don't offer this for free, so those stay manual.
 */
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v25.0'}`;
const YT = 'https://www.googleapis.com/youtube/v3';

export const instagramReady = () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
const ytKey = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || '';
export const youtubeReady = () => !!ytKey();
export const statsReady = () => ({ instagram: instagramReady(), youtube: youtubeReady() });

const failed = (platform: PlatformStats['platform'], handle: string, url: string, error: string): PlatformStats =>
  ({ platform, handle, url, followers: null, posts: null, sampled: 0, avgLikes: null, avgComments: null, avgViews: null, lastPostAt: null, postsLast30: null, checkedAt: new Date().toISOString(), error });

async function json(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error?.message || `HTTP ${res.status}`), { status: res.status });
  return body;
}

export async function instagramStats(url: string): Promise<PlatformStats | null> {
  const user = igUsername(url);
  if (!user) return failed('instagram', '', url, 'Not an Instagram profile link.');
  const qs = new URLSearchParams({
    fields: `business_discovery.username(${user}){username,followers_count,media_count,media.limit(12){timestamp,like_count,comments_count}}`,
    access_token: process.env.IG_ACCESS_TOKEN || '',
  });
  try {
    const d = (await json(`${GRAPH}/${process.env.IG_USER_ID}?${qs}`)).business_discovery;
    const posts = (d?.media?.data || []).map((p: any) => ({ at: p.timestamp, likes: p.like_count ?? null, comments: p.comments_count ?? null }));
    return { platform: 'instagram', handle: d?.username || user, url, followers: d?.followers_count ?? null, posts: d?.media_count ?? null, ...summarizePosts(posts), checkedAt: new Date().toISOString() };
  } catch (error) {
    const msg = String((error as Error).message || '');
    // Business Discovery only sees business and creator accounts.
    return failed('instagram', user, url, /business|creator|not.*found|Invalid user/i.test(msg) ? 'Personal account or not found: Instagram only shares numbers for business and creator accounts.' : `Instagram: ${msg.slice(0, 120)}`);
  }
}

export async function youtubeStats(url: string): Promise<PlatformStats | null> {
  const ref = ytRef(url);
  if (!ref) return failed('youtube', '', url, 'Not a YouTube channel link.');
  const key = ytKey();
  try {
    const by: Record<string, string> = ref.id ? { id: ref.id } : ref.handle ? { forHandle: `@${ref.handle}` } : { forUsername: ref.username! };
    const ch = (await json(`${YT}/channels?${new URLSearchParams({ part: 'snippet,statistics,contentDetails', ...by, key })}`)).items?.[0];
    if (!ch) return failed('youtube', ref.handle || ref.username || ref.id || '', url, 'Channel not found.');
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    let posts: { at: string; likes: number | null; comments: number | null; views: number | null }[] = [];
    if (uploads) {
      const items = (await json(`${YT}/playlistItems?${new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '12', key })}`)).items || [];
      const ids = items.map((i: any) => i.contentDetails?.videoId).filter(Boolean);
      const vids = ids.length ? (await json(`${YT}/videos?${new URLSearchParams({ part: 'statistics,snippet', id: ids.join(','), key })}`)).items || [] : [];
      posts = vids.map((v: any) => ({ at: v.snippet?.publishedAt, likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null, comments: v.statistics?.commentCount ? Number(v.statistics.commentCount) : null, views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null }));
    }
    const st = ch.statistics || {};
    return {
      platform: 'youtube', handle: ch.snippet?.customUrl || ch.snippet?.title || '', url,
      followers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount || 0), posts: Number(st.videoCount || 0), ...summarizePosts(posts), checkedAt: new Date().toISOString(),
    };
  } catch (error) { return failed('youtube', ref.handle || ref.username || ref.id || '', url, `YouTube: ${String((error as Error).message).slice(0, 120)}`); }
}

/** Numbers for every supported profile in a {platform: url} map (skips platforms not set up). */
export async function statsFor(socials: Record<string, string>): Promise<Record<string, PlatformStats>> {
  const out: Record<string, PlatformStats> = {};
  const jobs: Promise<void>[] = [];
  if (socials.instagram && instagramReady()) jobs.push(instagramStats(socials.instagram).then(s => { if (s) out.instagram = s; }));
  if (socials.youtube && youtubeReady()) jobs.push(youtubeStats(socials.youtube).then(s => { if (s) out.youtube = s; }));
  await Promise.all(jobs);
  return out;
}

/**
 * When our Instagram token expires, asked from Meta (debug_token), so it
 * resets by itself when a new token is saved. Cached for an hour.
 */
export type TokenStatus = { connected: boolean; valid: boolean; expiresAt: string | null; neverExpires: boolean; error?: string };
let tokenCache: { at: number; token: string; status: TokenStatus } | null = null;
export async function instagramTokenStatus(): Promise<TokenStatus> {
  const token = process.env.IG_ACCESS_TOKEN || '';
  if (!instagramReady()) return { connected: false, valid: false, expiresAt: null, neverExpires: false };
  if (tokenCache && tokenCache.token === token && Date.now() - tokenCache.at < 3600_000) return tokenCache.status;
  let status: TokenStatus;
  try {
    const d = (await json(`${GRAPH}/debug_token?${new URLSearchParams({ input_token: token, access_token: token })}`)).data || {};
    const exp = Number(d.expires_at || 0);
    status = { connected: true, valid: d.is_valid !== false, expiresAt: exp ? new Date(exp * 1000).toISOString() : null, neverExpires: exp === 0 };
  } catch (error) {
    status = { connected: true, valid: false, expiresAt: null, neverExpires: false, error: String((error as Error).message).slice(0, 120) };
  }
  tokenCache = { at: Date.now(), token, status };
  return status;
}
