import { NextResponse } from 'next/server';
import { errorResponse, HttpError, requireRole } from '@/lib/server/auth';
import { recruitCandidates } from '@/lib/server/market';
import { US_STATES } from '@/lib/registry';

/** Established movers in a state worth recruiting as agents (not already agents or prospects). */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const state = (new URL(req.url).searchParams.get('state') || '').toUpperCase().replace(/^US-/, '');
    if (!US_STATES.includes(state)) throw new HttpError(400, 'Choose a U.S. state.');
    return NextResponse.json({ candidates: await recruitCandidates(state) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
