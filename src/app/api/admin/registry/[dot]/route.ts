import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { findMover } from '@/lib/server/registry-query';
import { classifyAndSave, enrichmentFor, sosFor } from '@/lib/server/registry-enrich';
import { trackedByDot, trackMovers } from '@/lib/server/registry-track';
import { jevConfigured, KINDS } from '@/lib/server/jev';
import { sosSearchUrl } from '@/lib/server/sos';
import { REGISTRY_AREAS, yearsInBusiness } from '@/lib/registry';

/**
 * One registry company: everything on file, live FMCSA insurance filings,
 * the state business record (free states), Jev's classification, and links.
 * POST { action: 'classify' | 'sos' | 'track', tier? }.
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
    const [enr, tracked, ins] = await Promise.all([enrichmentFor([m.dot]), trackedByDot(), insurance(m.mc)]);
    const e = enr.get(m.dot);
    return NextResponse.json({
      mover: { ...m, years: yearsInBusiness(m) }, kind: e?.kind || null, kindLabel: e?.kind ? KINDS[e.kind] : null, kindConfidence: e?.kindConfidence ?? null,
      sos: e?.sos || null, sosSearchUrl: sosSearchUrl(m.state), insurance: ins, competitorId: tracked.get(m.dot) || null, jev: jevConfigured(),
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
    if (body.action === 'track') return NextResponse.json(await trackMovers([m], body.tier === 'legend' ? 'legend' : 'challenger', user.uid));
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
