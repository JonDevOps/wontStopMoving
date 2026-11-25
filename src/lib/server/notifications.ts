import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './firebase-admin';
import { customQuotePricingText } from '../custom-quotes';
import { queueReleaseText, queueMoveText, customerTextPhone } from './move-sms';
import { BUSINESS_EMAIL_SIGNATURE } from '../business-contact';
import { emailProviderConfigured } from './email-provider';
import { deliverEmail } from './email-outbox';
export { deliverEmail, processEmailQueue } from './email-outbox';

const ORIGIN = 'https://wontstopmoving.com';
export function mailConfigured() { return emailProviderConfigured(); }

export async function enqueueEmail(key: string, message: { to: string; subject: string; text: string; category: string; referenceId: string; unsubscribeUrl?: string }) {
  const id = createHash('sha256').update(key).digest('hex');
  const ref = adminDb().doc(`emailOutbox/${id}`);
  await adminDb().runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.create(ref, { ...message, text: `${message.text}\n\n${BUSINESS_EMAIL_SIGNATURE}`, status: 'pending', nextAttemptAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }); });
  return { id, status: await deliverEmail(id) };
}

export async function queueQuoteEmail(id: string) {
  const q = (await adminDb().doc(`quotes/${id}`).get()).data();
  if (!q?.isCustomQuote) throw new Error('CUSTOM_QUOTE_REQUIRED');
  return enqueueEmail(`quote:${id}`, { category: 'quote', referenceId: id, to: q.email, subject: 'Your Wont Stop Moving custom quote', text: `Hi ${q.name},\n\n${q.description}\n\n${customQuotePricingText(q.pricing)}\nRoute: ${q.pickupAddress} → ${q.dropoffAddress}\nMove date: ${q.moveDate}\nExpires: ${q.expiresAt.toDate().toISOString()}\n\nReview your private quote: ${ORIGIN}/custom-quotes/${id}\nUse a verified customer account with this email address.\n\nWont Stop Moving` });
}

export async function queueAccountApproval(uid: string, role: 'provider' | 'employee') {
  const account = await adminAuth().getUser(uid);
  if (!account.email) return null;
  return enqueueEmail(`approval:${role}:${uid}`, { category: 'approval', referenceId: uid, to: account.email, subject: 'Your Wont Stop Moving account is approved', text: `Your ${role} account has been approved. Review your dashboard for next steps:\n${ORIGIN}/dashboard/${role}\n\nWont Stop Moving` });
}

export async function queueJobEmails(jobId: string) {
  const job = (await adminDb().doc(`jobs/${jobId}`).get()).data();
  if (!job || job.paymentStatus !== 'paid' || job.status === 'cancelled') return;
  const recipients = new Map<string, string>();
  if (job.customerId) recipients.set(job.customerId, 'customer');
  for (const uid of job.providerIds || []) recipients.set(uid, 'provider');
  for (const uid of job.employeeIds || []) recipients.set(uid, 'employee');
  for (const [uid, role] of recipients) {
    let account;
    try { account = await adminAuth().getUser(uid); } catch (error: any) { if (error?.code === 'auth/user-not-found') continue; throw error; }
    if (!account.email) continue;
    await enqueueEmail(`job:${jobId}:${uid}`, { category: 'job', referenceId: jobId, to: account.email, subject: role === 'customer' ? 'Your moving booking is confirmed' : 'A moving job has been assigned to you', text: `View your ${role === 'customer' ? 'confirmed move' : 'assigned job'} in your secure dashboard:\n${ORIGIN}/dashboard/${role}/${role === 'customer' ? 'moves' : 'jobs'}/${jobId}\n\nSign in to view job details. Keep your payment release code private.\n\nWont Stop Moving` });
    if (role === 'customer' && job.status !== 'completed') {
      const secret = (await adminDb().doc(`jobSecrets/${jobId}`).get()).data();
      if (secret?.releaseCode) {
        const provider = job.providerIds?.[0] ? (await adminDb().doc(`providers/${job.providerIds[0]}`).get()).data() : null;
        const text = `Wont Stop Moving payment code: ${secret.releaseCode}\nCrew: ${provider?.businessName || 'Your moving crew'}\nService: ${job.service || 'moving'} on ${job.moveDate}\nJob: ${jobId}\n\nKeep this code private. Give it only to this crew after their work is complete to your satisfaction. It authorizes their payout. Separate crews have separate codes.\n\nYour job dashboard: ${ORIGIN}/dashboard/customer/moves/${jobId}`;
        const mail = await enqueueEmail(`release-code:${jobId}`, { category: 'release_code', referenceId: jobId, to: account.email, subject: 'Your private moving payment code', text });
        const textPhone = await customerTextPhone(job.customerId);
        const sms = textPhone ? await queueReleaseText(jobId, textPhone, `${text}\nReply STOP to stop texts. Message/data rates may apply.`) : 'not_requested';
        await adminDb().doc(`jobs/${jobId}`).update({ codeEmailStatus: mail.status, codeSmsStatus: sms });
      }
    }
  }
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org';
  await enqueueEmail(`job:${jobId}:admin`, { category: 'job', referenceId: jobId, to: adminEmail, subject: `New paid booking: ${job.moveDate || 'date pending'}`, text: `A booking was just paid.\n\nMove date: ${job.moveDate || 'Not set'}\nPickup: ${job.pickupAddress || 'Not set'}\nDrop-off: ${job.dropoffAddress || 'Not set'}\nAmount paid: $${Number(job.amountPaid || job.price || 0).toFixed(2)}\nAssigned providers: ${(job.providerIds || []).length}\n\nOpen the job:\n${ORIGIN}/dashboard/admin/jobs/${jobId}\n\nWont Stop Moving` });
}

/**
 * Sends the emails for a newly paid booking. Never throws: a mail problem must
 * not fail the payment confirmation that triggered it. Safe to call repeatedly;
 * each message is keyed, so it is created and sent at most once.
 */
export async function notifyPaidJob(jobId: string) {
  try { await queueJobEmails(jobId); } catch { console.error('Paid booking emails failed', jobId); }
  try { await notifyProviderTexts(jobId, 'assigned'); await adminDb().doc(`jobs/${jobId}`).update({assignmentTextsPending:false}); } catch { console.error('Provider job text needs attention', jobId); }
}

export async function notifyCompletedJobTexts(jobId: string) {
  await notifyReviewText(jobId);
  await notifyProviderTexts(jobId, 'completed');
  await adminDb().doc(`jobs/${jobId}`).update({completionTextsPending:false});
}

/** Provider alerts never contain the customer's private payment code. */
export async function notifyProviderTexts(jobId: string, event: 'assigned' | 'completed') {
  const db = adminDb(), job = (await db.doc(`jobs/${jobId}`).get()).data();
  if (!job || job.paymentStatus !== 'paid' || job.status === 'cancelled') return;
  if (event === 'assigned' && job.status === 'completed') return;
  if (event === 'completed' && (!job.releaseConfirmedAt || job.status !== 'completed')) return;
  for (const uid of job.providerIds || []) {
    const phone = await customerTextPhone(uid);
    if (!phone) continue;
    const text = event === 'assigned'
      ? `Wont Stop Moving: New paid ${job.service || 'moving'} job on ${job.moveDate}. Review the job and confirm the start time: ${ORIGIN}/dashboard/provider/jobs/${jobId}`
      : `Wont Stop Moving: The payment code for job ${jobId} was accepted. ${job.payoutStatus === 'paid' ? 'Your 85% payout was sent to your connected Stripe account; bank arrival may take longer.' : 'Your payout is awaiting processing or support follow-up.'} ${ORIGIN}/dashboard/provider/jobs/${jobId}`;
    await queueMoveText(`provider-${event}:${jobId}:${uid}`, jobId, phone, `${text} Reply STOP to opt out.`);
  }
}

export async function notifyReviewText(jobId: string) {
  const job = (await adminDb().doc(`jobs/${jobId}`).get()).data();
  if (!job || job.status !== 'completed' || !job.releaseConfirmedAt || !job.customerId) return;
  const phone = await customerTextPhone(job.customerId);
  if (!phone) return;
  const text = `Wont Stop Moving: Your crew's payment code was accepted. Review your move: ${ORIGIN}/dashboard/customer/moves/${jobId}${job.reviewRefundEligible ? ' Any honest star rating qualifies for a $5 refund to your original payment method.' : ''} Optional tipping is available after your review. Reply STOP to opt out.`;
  await queueMoveText(`review:${jobId}`, jobId, phone, text);
}
