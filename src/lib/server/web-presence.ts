import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { fetchPublicPageText } from './safe-fetch';
import { searchGrounded } from './gemini';
import { guessDomains, isDirectory, matchPage, urlsIn } from '@/lib/web-presence';
import { cleanSocials, platformOf } from '@/lib/competitors';
import type { Mover } from '@/lib/registry';

/**
 * A registry company's website and social profiles, found when you open
 * it (never in bulk). Free sources first:
 *   1. the domain of their email on the federal filing,
 *   2. likely domains from their name (acmemoving.com...),
 *   3. Google Search through Gemini (GEMINI_API_KEY; free monthly allowance),
 *   4. Brave Search, only if BRAVE_SEARCH_API_KEY is set.
 * A site only counts if the page shows their phone, USDOT number, or name
 * plus city. Social links come from the site itself; profiles that only
 * turned up in search are kept apart as "possible". Cached 30 days in
 * registryEnrichment/{dot}.web.
 */
export type Candidate = { url: string; source: Source; ok: boolean; matchedBy: string[]; error?: string };
type Source = 'email' | 'guess' | 'google' | 'brave';
export type WebPresence = {
  site: string | null; source: Source | null; matchedBy: string[];
  socials: Record<string, string>; possibleSocials: Record<string, string>;
  tried: Candidate[]; searched: string[]; checkedAt: string | null;
};

const MONTH = 30 * 86400_000;
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function cachedWebPresence(dot: string): Promise<WebPresence | null> {
  const web = (await adminDb().doc(`registryEnrichment/${dot}`).get()).data()?.web;
  return web ? { ...web, checkedAt: iso(web.checkedAt) } : null;
}

async function check(m: Mover, url: string, source: Source) {
  try {
    const page = await fetchPublicPageText(url, 60_000);
    let match = matchPage(m, page);
    // Name matches but nothing else on the home page: read their contact/about page too.
    if (!match.ok && match.matchedBy.includes('name')) {
      const origin = new URL(page.url).origin;
      for (const extra of [...page.about.slice(0, 1), `${origin}/contact`, `${origin}/contact-us`]) {
        try { const p2 = await fetchPublicPageText(extra, 30_000); match = matchPage(m, { title: page.title, text: `${page.text}\n${p2.text}` }); } catch { continue; }
        if (match.ok) break;
      }
    }
    return { candidate: { url: page.url, source, ...match } as Candidate, page };
  } catch (error) {
    return { candidate: { url, source, ok: false, matchedBy: [], error: error instanceof Error ? error.message.slice(0, 120) : 'Could not open' } as Candidate, page: null };
  }
}

async function googleCandidates(m: Mover) {
  const who = `${m.dba ? `${m.dba} (legal name ${m.name})` : m.name}, a moving company at ${m.street}, ${m.city}, ${m.state} ${m.zip}${m.phone ? `, phone ${m.phone}` : ''}, USDOT ${m.dot}`;
  const { text, sources } = await searchGrounded(`Search the web for the official website and social media profiles of ${who}.
Reply in plain lines only:
WEBSITE: <the company's own website URL, or NONE>
SOCIAL: <one profile URL per line: Facebook, Instagram, Yelp, Google Business, LinkedIn, TikTok, YouTube, X, Nextdoor, BBB>
Only list URLs that appear in the search results and clearly belong to this company (same name and city). Don't guess.`);
  const website = /WEBSITE:\s*(https?:\/\/\S+)/i.exec(text)?.[1];
  const urls = urlsIn(text);
  // Grounding sources come back as Google redirect links; their titles are usually the site's domain.
  const titled = sources.map(s => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s.title) ? `https://${s.title}` : '').filter(Boolean);
  const sites = [...new Set([website, ...urls, ...titled].filter((u): u is string => !!u && !isDirectory(u)))];
  return { sites, socials: urls.filter(u => platformOf(u)) };
}

async function braveCandidates(m: Mover) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null;
  const q = `"${m.dba || m.name}" movers ${m.city} ${m.state}`;
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q, count: '10', country: 'us' })}`, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Brave answered ${res.status}`);
  const urls = ((await res.json())?.web?.results || []).map((r: { url?: string }) => r.url || '').filter(Boolean) as string[];
  return { sites: urls.filter(u => !isDirectory(u)), socials: urls.filter(u => platformOf(u)) };
}

export async function findWebPresence(m: Mover, refresh = false): Promise<WebPresence> {
  const ref = adminDb().doc(`registryEnrichment/${m.dot}`);
  const cached = (await ref.get()).data()?.web;
  if (cached?.checkedAt) {
    const age = Date.now() - cached.checkedAt.toMillis();
    if (!refresh && age < MONTH) return { ...cached, checkedAt: iso(cached.checkedAt) };
    if (refresh && age < 10 * 60_000) return { ...cached, checkedAt: iso(cached.checkedAt) }; // Just checked.
  }
  const tried: Candidate[] = [], searched: string[] = [];
  let found: Awaited<ReturnType<typeof check>> | null = null, foundSource: Source | null = null;
  const possible: string[] = [];
  const seen = new Set<string>();
  const tryAll = async (urls: string[], source: Source) => {
    const fresh = urls.filter(u => { const h = u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '').toLowerCase(); if (seen.has(h)) return false; seen.add(h); return true; }).slice(0, 6);
    const results = await Promise.all(fresh.map(u => check(m, u, source)));
    tried.push(...results.map(r => r.candidate));
    const hit = results.find(r => r.candidate.ok);
    if (hit && !found) { found = hit; foundSource = source; }
  };

  if (m.site) {
    // The email domain is theirs; use it even if the page doesn't show a match.
    const r = await check(m, m.site, 'email');
    tried.push(r.candidate); seen.add(m.site.replace(/^https?:\/\/(www\.)?/, ''));
    if (r.page) { found = r; foundSource = 'email'; }
  }
  if (!found) await tryAll(guessDomains([m.dba, m.name]), 'guess');
  if (!found && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
    searched.push('Google (via Gemini)');
    try { const g = await googleCandidates(m); possible.push(...g.socials); await tryAll(g.sites, 'google'); }
    catch (error) { console.error('Website search (Google) failed', m.dot, error); }
  }
  if (!found && process.env.BRAVE_SEARCH_API_KEY) {
    searched.push('Brave');
    try { const b = await braveCandidates(m); if (b) { possible.push(...b.socials); await tryAll(b.sites, 'brave'); } }
    catch (error) { console.error('Website search (Brave) failed', m.dot, error); }
  }

  const hit = found as Awaited<ReturnType<typeof check>> | null;
  const socials = cleanSocials(hit?.page?.social || []);
  const possibleSocials = Object.fromEntries(Object.entries(cleanSocials(possible)).filter(([k]) => !socials[k]));
  const web = {
    site: hit ? new URL(hit.candidate.url).origin : null, source: foundSource, matchedBy: hit?.candidate.matchedBy || [],
    socials, possibleSocials, tried: tried.slice(0, 15), searched,
  };
  await ref.set({ dot: m.dot, state: m.state, web: { ...web, checkedAt: FieldValue.serverTimestamp() } }, { merge: true });
  return { ...web, checkedAt: new Date().toISOString() };
}
