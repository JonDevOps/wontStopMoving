import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { findMover } from '@/lib/server/registry-query';
import { classifyAndSave, enrichmentFor, sosFor } from '@/lib/server/registry-enrich';
import { trackedByDot, trackMovers } from '@/lib/server/registry-track';
import { jevConfigured, KINDS } from '@/lib/server/jev';
import { sosSearchUrl } from '@/lib/server/sos';
import { adoptWebsite, cachedWebPresence, findWebPresence } from '@/lib/server/web-presence';
import { googleInfo, placesConfigured, placesUsage, PlacesBudgetError } from '@/lib/server/places';
import { statsFor, statsReady } from '@/lib/server/social-stats';
import { strategyFor } from '@/lib/server/legends';
import { safetyFor } from '@/lib/server/safety';
import { adminDb } from '@/lib/server/firebase-admin';
import { activityOf, combineStats, socialScore } from '@/lib/social-stats';
import { REGISTRY_AREAS, yearsInBusiness } from '@/lib/registry';

/**
 * One registry company: everything on file, live FMCSA insurance filings,
 * the state business record (free states), Jev's classification, and links.
 * POST { action: 'classify' | 'sos' | 'track' | 'web', tier?, refresh? }.
 * 'web' finds their website and social profiles (see web-presence.ts).
 * 'google' shows their Google Business listing live (see places.ts; nothing but the place ID is kept).
 */
const INSURANCE = 'https://data.transportation.gov/resource/ypjt-5ydn.json';
const INS_TYPES: Record<string, string> = { '1': 'Bodily injury & property damage (liability)', '2': 'Cargo', '3': 'Bond', '4': 'Trust fund' };

async function target(req: Request, params: Promise<{ dot: string }>) {
  const { user } = await requireRole(req, ['admin']);
  const { dot } = await params;
  const state = (new URL(req.url).searchParams.get('state') || '').toUpperCase();
  if (!/^\d{1,9}$/.test(dot) || !REGISTRY_AREAS.includes(state)) throw new HttpError(400, 'Choose a company.');
  const m = await findMover(dot, state);
  if (!m) throw new HttpError(404, 'Company not found in the registry.');
  return { user, m };
}

async function insurance(mc: string) {
  const digits = mc.replace(/\D/g, '');
  if (!digits) return [];
  const prefix = `MC${digits.padStart(6, '0')}`;
  const qs = new URLSearchParams({ $where: `prefix_docket_number='${prefix}'`, $limit: '20' });
  const res = await fetch(`${INSURANCE}?${qs}`, { signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!res?.ok) return [];
  const rows = await res.json() as Record<string, string>[];
  return rows.map(r => ({ type: INS_TYPES[r.ins_type_code] || r.ins_type_code, insurer: r.name_company || '', policy: r.policy_no || '', coverage: Number(r.max_cov_amount || 0) * 1000, effective: r.effective_date || '' }))
    .sort((a, b) => Date.parse(b.effective) - Date.parse(a.effective));
}

export async function GET(req: Request, { params }: { params: Promise<{ dot: string }> }) {
  try {
    const { m } = await target(req, params);
    const [enr, tracked, ins, web, usage] = await Promise.all([enrichmentFor([m.dot]), trackedByDot(), insurance(m.mc), cachedWebPresence(m.dot), placesConfigured() ? placesUsage() : null]);
    const e = enr.get(m.dot);
    return NextResponse.json({
      mover: { ...m, years: yearsInBusiness(m) }, kind: e?.kind || null, kindLabel: e?.kind ? KINDS[e.kind] : null, kindConfidence: e?.kindConfidence ?? null,
      sos: e?.sos || null, sosSearchUrl: sosSearchUrl(m.state), insurance: ins, web, searchReady: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), braveReady: !!process.env.BRAVE_SEARCH_API_KEY, places: { ready: placesConfigured(), usage }, statsReady: statsReady(), socialStats: e?.socialStats || null, social: e?.socialStats ? (() => { const sum = combineStats(e.socialStats as never); return { summary: sum, score: socialScore(sum), activity: activityOf(sum) }; })() : null, strategy: e?.strategy || null, safety: e?.safety || null, competitorId: tracked.get(m.dot) || null, jev: jevConfigured(),
      links: {
        safer: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${m.dot}`,
        sms: `https://ai.fmcsa.dot.gov/SMS/Carrier/${m.dot}/CarrierRegistration.aspx`,
        google: `https://www.google.com/search?q=${encodeURIComponent(`${m.dba || m.name} ${m.city} ${m.state} reviews`)}`,
        maps: `https://www.google.com/maps/search/${encodeURIComponent(`${m.dba || m.name} ${m.street} ${m.city} ${m.state}`)}`,
        yelp: `https://www.yelp.com/search?find_desc=${encodeURIComponent(m.dba || m.name)}&find_loc=${encodeURIComponent(`${m.city}, ${m.state}`)}`,
        bbb: `https://www.bbb.org/search?find_text=${encodeURIComponent(m.dba || m.name)}&find_loc=${encodeURIComponent(`${m.city}, ${m.state}`)}`,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ dot: string }> }) {
  try {
    const { user, m } = await target(req, params);
    const body = await readJson(req);
    if (body.action === 'classify') {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      try { return NextResponse.json(await classifyAndSave(m)); }
      catch (error) { console.error('Jev classify failed', m.dot, error); throw new HttpError(502, 'Jev didn’t answer. Try again in a minute.'); }
    }
    if (body.action === 'sos') {
      try { return NextResponse.json(await sosFor(m, true)); }
      catch (error) { console.error('Registry lookup failed', m.dot, error); throw new HttpError(502, 'The state registry didn’t answer. Try again later.'); }
    }
    if (body.action === 'web') {
      try { return NextResponse.json(await findWebPresence(m, body.refresh === true)); }
      catch (error) { console.error('Website lookup failed', m.dot, error); throw new HttpError(502, 'The website search didn’t finish. Try again in a minute.'); }
    }
    if (body.action === 'safety') {
      try { return NextResponse.json(await safetyFor(m, body.refresh === true)); }
      catch (error) { console.error('Safety lookup failed', m.dot, error); throw new HttpError(502, 'The DOT data didn’t answer. Try again in a minute.'); }
    }
    if (body.action === 'strategy') {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      try { return NextResponse.json(await strategyFor(m, (await enrichmentFor([m.dot])).get(m.dot))); }
      catch (error) { console.error('Jev strategy failed', m.dot, error); throw new HttpError(502, 'Jev didn’t answer. Try again in a minute.'); }
    }
    if (body.action === 'social-stats') {
      const ready = statsReady();
      if (!ready.instagram && !ready.youtube) throw new HttpError(503, 'Instagram and YouTube numbers aren’t set up yet.');
      const web = await cachedWebPresence(m.dot);
      const stats = await statsFor(web?.socials || {});
      await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, socialStats: stats, socialStatsAt: new Date() }, { merge: true });
      const sum = combineStats(stats);
      return NextResponse.json({ socialStats: stats, social: { summary: sum, score: socialScore(sum), activity: activityOf(sum) } });
    }
    if (body.action === 'google') {
      try {
        const { info, usage } = await googleInfo(m);
        // Their Google listing's website, if their own page confirms it, fills a missing website.
        const web = info?.website ? await adoptWebsite(m, info.website, 'places').catch(() => null) : null;
        return NextResponse.json({ info, usage, web }, { headers: { 'Cache-Control': 'private, no-store' } });
      } catch (error) {
        if (error instanceof PlacesBudgetError) throw new HttpError(429, error.message);
        console.error('Google Places lookup failed', m.dot, error);
        if (error instanceof Error && /set up/.test(error.message)) throw new HttpError(503, error.message);
        throw new HttpError(502, 'Google didn’t answer. Try again in a minute.');
      }
    }
    if (body.action === 'track') {
      // Use a website we found for them when the federal record has none.
      const web = m.site ? null : await cachedWebPresence(m.dot);
      return NextResponse.json(await trackMovers([web?.site ? { ...m, site: web.site } : m], body.tier === 'legend' ? 'legend' : 'challenger', user.uid));
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
