import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { jevGroup, legends, matchGroup } from '@/lib/server/legends';
import { placesConfigured, placesUsage } from '@/lib/server/places';
import { jevConfigured } from '@/lib/server/jev';
import { GROUP_LABEL, type LegendGroup } from '@/lib/legends';

/**
 * The Legends board. GET: every group with what we know.
 * POST { action: 'match-google' | 'jev', group }: works through 40 at a time.
 */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const force = new URL(req.url).searchParams.get('refresh') === '1';
    const [data, usage] = await Promise.all([legends(force), placesConfigured() ? placesUsage() : null]);
    return NextResponse.json({ ...data, places: { ready: placesConfigured(), usage } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const body = await readJson(req);
    const group = body.group as LegendGroup;
    if (!(group in GROUP_LABEL)) throw new HttpError(400, 'Choose a list.');
    if (body.action === 'match-google') {
      if (!placesConfigured()) throw new HttpError(503, 'Google Places isn’t set up yet (GOOGLE_CLOUD_API_KEY).');
      return NextResponse.json({ ...(await matchGroup(group)), usage: await placesUsage() });
    }
    if (body.action === 'jev') {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      return NextResponse.json(await jevGroup(group));
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
