import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { refundReviewedMove } from '@/lib/server/move-benefits';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const { jobId } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, 'Choose a move.');
    const job = (await adminDb().doc(`jobs/${jobId}`).get()).data();
    if (!job || job.customerId !== user.uid) throw new HttpError(404, 'Move not found.');
    return NextResponse.json({ refundStatus: await refundReviewedMove(jobId) });
  } catch (error) { return errorResponse(error); }
}
