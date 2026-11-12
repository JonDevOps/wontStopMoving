import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { getResearch, researchCompany } from '@/lib/server/agent-research';
import { REGISTRY_AREAS } from '@/lib/registry';

/** Pre-call AI briefing on a company before inviting it into the agent network. */
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const key = new URL(req.url).searchParams.get('key') || '';
    if (!/^[a-z0-9-]{1,80}$/.test(key) && !/^\d{1,9}$/.test(key)) throw new HttpError(400, 'Choose a company.');
    return NextResponse.json({ result: await getResearch(key) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const b = await readJson(req);
    const dot = typeof b.dot === 'string' && /^\d{1,9}$/.test(b.dot) ? b.dot : undefined;
    const state = typeof b.state === 'string' && REGISTRY_AREAS.includes(b.state.toUpperCase().replace(/^(US|CA)-/, '')) ? b.state.toUpperCase().replace(/^(US|CA)-/, '') : undefined;
    const name = typeof b.name === 'string' ? b.name.slice(0, 160) : undefined, website = typeof b.website === 'string' ? b.website.slice(0, 300) : undefined;
    if (!dot && !website && !name) throw new HttpError(400, 'Choose a company.');
    try { return NextResponse.json(await researchCompany({ dot, state, name, website, city: typeof b.city === 'string' ? b.city.slice(0, 80) : undefined })); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      const msg = error instanceof Error ? error.message : '';
      throw new HttpError(/just researched|Choose a company/.test(msg) ? 409 : 502, /just researched|Choose a company/.test(msg) ? msg : 'The AI research didn’t finish. Try again in a minute.');
    }
  } catch (error) { return errorResponse(error); }
}
