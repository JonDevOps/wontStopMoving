import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { enqueueEmail } from './notifications';
import { MOVE_PRICING } from '@/lib/pricing';
import { dueFollowUpStep, followUpEmail, FOLLOW_UP_MAX_AGE_HOURS } from '@/lib/quote-followups';

const ORIGIN = 'https://wontstopmoving.com';
const PHONE = '(415) 214-5474';
const MAX_PER_RUN = 50;

/** Suppression list key: a hash, so the list never stores raw addresses as IDs. */
export const suppressionId = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

/**
 * Sends the follow-up emails that are due. Run hourly by Cloud Scheduler.
 * Each step is keyed per quote, so a retry or overlap never sends twice.
 */
export async function runQuoteFollowUps(nowMs = Date.now()) {
  const db = adminDb();
  const since = Timestamp.fromMillis(nowMs - FOLLOW_UP_MAX_AGE_HOURS * 3600000);
  const snap = await db.collection('quotes').where('createdAt', '>=', since).limit(1000).get();
  let sent = 0, skipped = 0, failed = 0;
  for (const doc of snap.docs) {
    if (sent >= MAX_PER_RUN) break;
    const q = doc.data();
    if (q.isCustomQuote) continue;
    const email = typeof q.email === 'string' ? q.email.trim().toLowerCase() : '';
    const base = { createdAtMs: q.createdAt?.toMillis?.() ?? null, sentStep: Number(q.followUpStep || 0), hasEmail: !!email, booked: q.status === 'processed' || q.paymentStatus === 'paid', lost: q.leadStatus === 'lost', stopped: q.followUpsStopped === true, suppressed: false };
    if (dueFollowUpStep(base, nowMs) === null) continue;
    try {
      const suppressed = (await db.doc(`emailSuppressions/${suppressionId(email)}`).get()).exists;
      const step = dueFollowUpStep({ ...base, suppressed }, nowMs);
      if (step === null) { skipped++; continue; }
      // One unsubscribe token per quote, kept on the quote (server-only field).
      const token = await db.runTransaction(async tx => {
        const current = (await tx.get(doc.ref)).data() || {};
        if (Number(current.followUpStep || 0) >= step) return null; // Another run got here first.
        const t = typeof current.followUpToken === 'string' ? current.followUpToken : randomBytes(18).toString('hex');
        tx.update(doc.ref, { followUpToken: t, followUpStep: step, followUpSentAt: FieldValue.serverTimestamp() });
        return t;
      });
      if (!token) { skipped++; continue; }
      const params = `q=${encodeURIComponent(doc.id)}&t=${token}`;
      const message = followUpEmail(step, {
        name: q.name, moveLabel: MOVE_PRICING[q.moveSize]?.description || 'Your move',
        route: `${q.pickupZip || q.pickupAddress || '?'} → ${q.dropoffZip || q.dropoffAddress || '?'}`, moveDate: q.moveDate, total: Number(q.estimatedTotal || 0),
      }, { bookUrl: `${ORIGIN}/dashboard/customer/quotes`, quoteUrl: `${ORIGIN}/quote`, unsubscribeUrl: `${ORIGIN}/unsubscribe?${params}`, phone: PHONE, postalAddress: process.env.BUSINESS_POSTAL_ADDRESS });
      await enqueueEmail(`followup:${doc.id}:${step}`, { category: 'follow-up', referenceId: doc.id, to: email, ...message, unsubscribeUrl: `${ORIGIN}/api/unsubscribe?${params}` });
      sent++;
    } catch (error) {
      failed++;
      console.error('Quote follow-up failed', doc.id, error);
    }
  }
  return { checked: snap.size, sent, skipped, failed };
}
