import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe } from '@/lib/server/auth';
import { payoutCompletedJob } from '@/lib/server/jobs';
import { refundReviewedMove } from '@/lib/server/move-benefits';
import { moveSmsConfigured } from '@/lib/server/move-sms';

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [payouts, refunds, pendingRefunds, texts, operations] = await Promise.all([
      db.collection('jobs').where('payoutStatus', 'in', ['processing', 'needs_manual_payout']).limit(100).get(),
      db.collection('jobs').where('reviewRefundStatus', 'in', ['pending', 'needs_review', 'processing']).limit(100).get(),
      db.collection('jobs').where('reviewRefundStatus', '==', 'pending_configuration').limit(100).get(),
      db.collection('smsOutbox').where('status', 'in', ['pending', 'needs_review', 'sending']).limit(100).get(),
      db.collection('moneyOperations').where('status', 'in', ['processing', 'needs_review']).limit(100).get(),
    ]);
    return NextResponse.json({ smsConfigured: moveSmsConfigured(), payouts: payouts.docs.map(doc => doc.id), refunds: [...new Set([...refunds.docs, ...pendingRefunds.docs].map(doc => doc.id))], texts: texts.docs.map(doc => ({ jobId: doc.data().jobId, status: doc.data().status })), operations: operations.docs.map(doc => ({ id: doc.id, status: doc.data().status, resultId: doc.data().resultId || null })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const { jobId, action } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, 'Choose a job.');
    requireStripe();
    if (action === 'payout') return NextResponse.json(await payoutCompletedJob(jobId));
    if (action === 'refund') return NextResponse.json({ status: await refundReviewedMove(jobId) });
    throw new HttpError(400, 'Choose payout or refund recovery.');
  } catch (error) { return errorResponse(error); }
}
