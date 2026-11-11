import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, requireRole } from '@/lib/server/auth';
import { overflowPartners } from '@/lib/server/market';

/** Overflow: our nearest partners plus licensed movers within 25 miles of the pickup. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['admin']);
    const { id } = await params;
    if (!isId(id)) throw new HttpError(404, 'Move not found.');
    const job = (await adminDb().doc(`jobs/${id}`).get()).data();
    if (!job) throw new HttpError(404, 'Move not found.');
    const miles = Math.min(Math.max(Number(new URL(req.url).searchParams.get('miles')) || 25, 5), 100);
    return NextResponse.json({ ...(await overflowPartners(job, miles)), routing: job.routing ? { ...job.routing, computedAt: job.routing.computedAt?.toDate?.().toISOString() || null } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
