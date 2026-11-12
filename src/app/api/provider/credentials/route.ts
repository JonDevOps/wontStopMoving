import { NextResponse } from 'next/server';
import { errorResponse, readJson, requireRole } from '@/lib/server/auth';
import { getMoverProfile, saveMoverProfile, verifyWithFmcsa } from '@/lib/server/mover-profile';
import { cleanProfileInput, profileIssues } from '@/lib/mover-profile';

/** The signed-in mover's credentials profile and what's missing. */
export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['provider']);
    const data = await getMoverProfile(user.uid);
    return NextResponse.json({ ...data, issues: profileIssues(data.profile, { needsDot: data.needsDot }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Save license and insurance details; optionally give background-check consent. USDOT changes are checked with FMCSA. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['provider']);
    const body = await readJson(req);
    const fields = cleanProfileInput(body);
    const before = await getMoverProfile(user.uid);
    if (fields.usdot && fields.usdot !== before.profile.usdot) await verifyWithFmcsa(user.uid, fields.usdot);
    const result = await saveMoverProfile(user.uid, fields, body.backgroundConsent === true);
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
