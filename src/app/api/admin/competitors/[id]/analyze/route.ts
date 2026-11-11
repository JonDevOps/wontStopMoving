import { NextResponse } from 'next/server';
import { errorResponse, HttpError, isId, requireRole } from '@/lib/server/auth';
import { analyzeCompetitor } from '@/lib/server/competitors';

export const maxDuration = 60;

/** Reads the competitor's website and has AI write intel plus a 30-day plan to beat them. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['admin']);
    const { id } = await params;
    if (!isId(id)) throw new HttpError(400, 'Choose a competitor.');
    try { return NextResponse.json(await analyzeCompetitor(id)); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Competitor analysis failed', id, error);
      throw new HttpError(502, error instanceof Error && /not found|just analyzed/.test(error.message) ? error.message : 'The AI analysis failed. Try again in a minute.');
    }
  } catch (error) { return errorResponse(error); }
}
