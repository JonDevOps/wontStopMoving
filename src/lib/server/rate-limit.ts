/**
 * Simple per-instance rate limiter for public endpoints (by client IP).
 * Not a security boundary on its own; it keeps one visitor from hammering
 * the free government APIs we depend on.
 */
const hits = new Map<string, number[]>();
export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= limit) { hits.set(key, list); return false; }
  list.push(now); hits.set(key, list);
  if (hits.size > 20000) hits.delete(hits.keys().next().value!);
  return true;
}
