/**
 * Optional free Socrata app token (SODA_APP_TOKEN) for the government open
 * data APIs (data.transportation.gov and state portals). Without it,
 * requests are anonymous and rate-limited per server IP.
 */
export const sodaHeaders = (): Record<string, string> => (process.env.SODA_APP_TOKEN ? { 'X-App-Token': process.env.SODA_APP_TOKEN } : {});

export class RateLimited extends Error { constructor() { super('Government open data is rate-limiting us; will retry later.'); } }

/**
 * fetch() for government open data: sends the app token if set, and on
 * "too many requests" (429) or "busy" (503) waits once and retries. If it's
 * still limited, throws RateLimited so callers stop instead of pushing harder.
 */
export async function politeFetch(url: string, timeoutMs = 30_000, waitMs = 8_000): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json', ...sodaHeaders() } });
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt === 0) await new Promise(r => setTimeout(r, Number(res.headers.get('retry-after')) * 1000 || waitMs));
  }
  throw new RateLimited();
}
