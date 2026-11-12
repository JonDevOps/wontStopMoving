import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetches a public web page's text for AI analysis. Only http(s) on normal
 * ports, never private, loopback or cloud metadata addresses (checked on
 * every redirect), with a short timeout and a size cap.
 */
const MAX_BYTES = 600_000;
const SOCIAL_HOST = /^(facebook\.com|fb\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|x\.com|twitter\.com|yelp\.com|google\.com|g\.page|nextdoor\.com|bbb\.org|thumbtack\.com|angi\.com|angieslist\.com|homeadvisor\.com|threads\.(net|com)|pinterest\.[a-z.]+|reddit\.com|discord\.gg|discord\.com|bsky\.app|mastodon\.[a-z]+|mstdn\.[a-z]+|fosstodon\.org|mas\.to|medium\.com|github\.com)$/i;

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('Only plain http(s) web addresses can be checked.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('That web address uses an unusual port.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) || !host.includes('.') || /(^|\.)(localhost|internal|local)$/i.test(host)) throw new Error('That web address is not a public website.');
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) throw new Error('That web address is not a public website.');
  return url;
}

/** Visible text of an HTML page (scripts, styles and tags removed). */
export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').trim();
  const description = (/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] || '').trim();
  const text = html
    .replace(/<(script|style|noscript|svg|iframe|title|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { title, description, text };
}

export async function fetchPublicPageText(raw: string, maxChars = 14_000): Promise<{ url: string; title: string; description: string; text: string; links: string[]; about: string[]; social: string[] }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WontStopMovingResearch/1.0)', Accept: 'text/html' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The website answered with an error (${res.status}).`);
    if (!/text\/html|application\/xhtml/i.test(res.headers.get('content-type') || '')) throw new Error('That address is not a web page.');
    const reader = res.body?.getReader();
    let html = '', bytes = 0;
    const decoder = new TextDecoder();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes > MAX_BYTES) { await reader.cancel(); break; }
    }
    const page = htmlToText(html);
    const host = url.hostname.replace(/^www\./, '');
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => { try { return { href: new URL(m[1], url).toString(), text: m[2].replace(/<[^>]+>/g, ' ').trim() }; } catch { return null; } })
      .filter((l): l is { href: string; text: string } => !!l && /^https?:/.test(l.href) && new URL(l.href).hostname.replace(/^www\./, '') === host)
      .filter(l => /price|pricing|rate|cost|quote|estimate/i.test(`${l.href} ${l.text}`)).map(l => l.href);
    const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => { try { return { href: new URL(m[1], url).toString(), text: m[2].replace(/<[^>]+>/g, ' ').trim() }; } catch { return null; } }).filter((l): l is { href: string; text: string } => !!l && /^https?:/.test(l.href));
    const about = [...new Set(anchors.filter(l => new URL(l.href).hostname.replace(/^www\./, '') === host && /about|team|story|founder|owner|history|who-we-are|our-company/i.test(`${l.href} ${l.text}`)).map(l => l.href))].slice(0, 3);
    // Profile links on any platform we track (see SOCIAL_PLATFORMS in src/lib/competitors.ts).
    const social = [...new Set(anchors.map(l => l.href).filter(h => SOCIAL_HOST.test(new URL(h).hostname.replace(/^(www|m)\./, '')) && new URL(h).pathname.length > 1))].slice(0, 20);
    return { url: url.toString(), ...page, text: page.text.slice(0, maxChars), links: [...new Set(links)].slice(0, 5), about, social };
  }
  throw new Error('The website redirected too many times.');
}

/** Fetches an RSS/Atom feed from a public address (same SSRF checks and size cap as pages). */
export async function fetchPublicFeed(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WontStopMovingFeeds/1.0)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The feed answered with an error (${res.status}).`);
    if (!/xml|rss|atom/i.test(res.headers.get('content-type') || '')) throw new Error('That address is not an RSS or Atom feed.');
    const reader = res.body?.getReader();
    let xml = '', bytes = 0;
    const decoder = new TextDecoder();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      xml += decoder.decode(value, { stream: true });
      if (bytes > MAX_BYTES) { await reader.cancel(); break; }
    }
    return xml;
  }
  throw new Error('The feed redirected too many times.');
}
