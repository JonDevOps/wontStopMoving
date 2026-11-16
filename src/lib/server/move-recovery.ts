import { adminDb } from './firebase-admin';
import { payoutCompletedJob } from './jobs';
import { refundReviewedMove } from './move-benefits';
import { notifyPaidJob, notifyCompletedJobTexts } from './notifications';
import { deliverMoveText } from './move-sms';

/** Runs from the existing authenticated hourly scheduler; each money request is durable and idempotent. */
export async function runMovePaymentRecovery() {
  const db = adminDb();
  const [payouts, refunds, emails, texts] = await Promise.all([
    db.collection('jobs').where('payoutStatus', 'in', ['processing', 'needs_manual_payout']).limit(100).get(),
    db.collection('jobs').where('reviewRefundStatus', 'in', ['pending', 'pending_configuration', 'needs_review', 'processing']).limit(100).get(),
    db.collection('jobs').where('codeEmailStatus', '==', 'pending_configuration').limit(100).get(),
    db.collection('jobs').where('codeSmsStatus', '==', 'pending_configuration').limit(100).get(),
  ]);
  let checked = 0, failed = 0;
  for (const item of payouts.docs) { try { await payoutCompletedJob(item.id); checked++; } catch { failed++; } }
  for (const item of refunds.docs) { try { await refundReviewedMove(item.id); checked++; } catch { failed++; } }
  for (const id of new Set([...emails.docs, ...texts.docs].map(doc => doc.id))) await notifyPaidJob(id);
  for (const [flag, notify] of [['assignmentTextsPending',notifyPaidJob],['completionTextsPending',notifyCompletedJobTexts]] as const) {
    const jobs = await db.collection('jobs').where(flag,'==',true).limit(100).get();
    for (const job of jobs.docs) { try { await notify(job.id); } catch { failed++; } }
  }
  const unsent = await db.collection('smsOutbox').where('status','==','pending').limit(100).get();
  for (const message of unsent.docs) { try { await deliverMoveText(message.id); } catch { failed++; } }
  return { checked, failed, pendingDelivery: emails.size + texts.size };
}
