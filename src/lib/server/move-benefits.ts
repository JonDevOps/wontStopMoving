import { applyCredit, verifyJobCredit } from './rewards';
import { refundTenderSplit } from '../rewards';
import type Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { adminDb } from './firebase-admin';
import { HttpError, requireStripe, stripeConfigured } from './auth';
import { moneyOperation } from './money-operation';
import { REVIEW_REFUND_CENTS, tipShareCents } from '../mover-cart';

/** The platform funds this refund; no transfer reversal and no change to the mover's allocation. */
export async function refundReviewedMove(jobId: string) {
  const db = adminDb(), ref = db.doc(`jobs/${jobId}`), job = (await ref.get()).data();
  if (!job?.reviewRefundEligible || !job.reviewed || !job.releaseConfirmedAt || job.status !== 'completed' || job.paymentStatus !== 'paid') return 'ineligible';
  if (job.reviewRefundStatus === 'refunded') return 'refunded';
  if (job.paymentHold) { await ref.update({ reviewRefundStatus: 'needs_review' }); return 'needs_review'; }
  if (!stripeConfigured()) { await ref.update({ reviewRefundStatus: 'pending_configuration' }); return 'pending_configuration'; }
  try {
    await verifyJobCredit(job);
    if (!(job.platformFeeCents >= REVIEW_REFUND_CENTS)) throw new Error('REFUND_REQUIRES_REVIEW');
    const giftCents = Math.round(Number(job.giftApplied || 0) * 100);
    const cardCents = Math.round(Number(job.amountPaid ?? ((job.allocatedCents || 0) / 100)) * 100);
    const split = refundTenderSplit(REVIEW_REFUND_CENTS, giftCents, cardCents);
    if (split.cardCents === 0) {
      await finishReviewGiftRefund(jobId, split.giftCents, null);
      return 'refunded';
    }
    if (job.reviewRefundId) {
      await updateReviewRefund(await stripe.refunds.retrieve(job.reviewRefundId));
      return (await ref.get()).data()?.reviewRefundStatus || 'processing';
    }
    const result = await moneyOperation(db, `review-refund-${jobId}`, { payment_intent: job.paymentIntentId, amount: split.cardCents, metadata: { jobId, kind: 'review_refund', reviewRefundTotal: String(REVIEW_REFUND_CENTS), giftRefundCents: String(split.giftCents) } }, async (request, key) => {
      const pi = await stripe.paymentIntents.retrieve(String(request.payment_intent), { expand: ['latest_charge'] });
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      if (pi.status !== 'succeeded' || pi.currency !== 'usd' || !charge || charge.disputed || charge.amount - charge.amount_refunded < Number(request.amount) || job.platformFeeCents < REVIEW_REFUND_CENTS) throw new Error('REFUND_REQUIRES_REVIEW');
      return stripe.refunds.create(request as unknown as Stripe.RefundCreateParams, { idempotencyKey: key });
    });
    const status = result.status === 'succeeded' ? 'refunded' : ['failed', 'canceled'].includes(result.status || '') ? 'needs_review' : 'processing';
    await ref.update({ reviewRefundId: result.id, reviewRefundStatus: status === 'refunded' && split.giftCents ? 'processing' : status, reviewRefundCents: split.cardCents, reviewRefundGiftCents: split.giftCents });
    if (status === 'refunded') await finishReviewGiftRefund(jobId, split.giftCents, result.id);
    return status;
  } catch { await ref.update({ reviewRefundStatus: 'needs_review' }); return 'needs_review'; }
}

async function finishReviewGiftRefund(jobId: string, giftCents: number, refundId: string | null) {
  const db = adminDb(), ref = db.doc(`jobs/${jobId}`);
  await db.runTransaction(async tx => {
    const job = (await tx.get(ref)).data();
    if (!job || job.reviewRefundStatus === 'refunded') return;
    if (job.paymentHold || !job.reviewed || !job.reviewRefundEligible || !job.releaseConfirmedAt) throw new Error('REFUND_REQUIRES_REVIEW');
    if (giftCents) await applyCredit(tx, job.customerId, giftCents / 100, 'review-gift-refund', `review-refund-${jobId}`, { jobId });
    tx.update(ref, { reviewRefundStatus: 'refunded', reviewRefundId: refundId, reviewRefundGiftCents: giftCents, reviewRefundCents: REVIEW_REFUND_CENTS - giftCents });
  });
}

export async function updateReviewRefund(refund: Stripe.Refund) {
  const jobId = refund.metadata?.kind === 'review_refund' && refund.metadata.jobId;
  if (!jobId) return;
  const db = adminDb(), ref = db.doc(`jobs/${jobId}`), job = (await ref.get()).data();
  if (!job || !job.reviewRefundEligible || (job.reviewRefundId && job.reviewRefundId !== refund.id)) return;
  const split = refundTenderSplit(REVIEW_REFUND_CENTS, Math.round(Number(job.giftApplied || 0) * 100), Math.round(Number(job.amountPaid ?? (job.allocatedCents || 0) / 100) * 100));
  const intent = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  if (intent !== job.paymentIntentId || refund.currency !== 'usd' || refund.amount !== split.cardCents) return;
  if (job.reviewRefundStatus === 'refunded' && !['failed','canceled'].includes(refund.status || '')) return;
  await verifyJobCredit(job);
  if (refund.status === 'succeeded') await finishReviewGiftRefund(jobId, split.giftCents, refund.id);
  else await ref.update({ reviewRefundId: refund.id, reviewRefundCents: split.cardCents, reviewRefundGiftCents: split.giftCents, reviewRefundStatus: ['failed','canceled'].includes(refund.status || '') ? 'needs_review' : 'processing' });
}

export async function createTipCheckout(uid: string, email: string | undefined, jobId: string, cents: unknown, origin: string) {
  if (typeof cents !== 'number' || !Number.isInteger(cents) || cents < 100 || cents > 100000) throw new HttpError(400, 'Choose a tip between $1 and $1,000.');
  const db = adminDb(), jobRef = db.doc(`jobs/${jobId}`), tipRef = db.doc(`moveTips/${jobId}`);
  const job = (await jobRef.get()).data();
  if (!job || job.customerId !== uid) throw new HttpError(404, 'Move not found.');
  if (job.status !== 'completed' || !job.reviewed || job.paymentHold) throw new HttpError(409, 'Submit your review after the move is completed before leaving a tip.');
  const providerId = job.payeeProviderId || job.providerIds?.[0];
  if (!providerId || !(await db.doc(`providers/${providerId}/reviews/${jobId}`).get()).exists) throw new HttpError(409, 'Submit your review first.');
  const provider = (await db.doc(`providers/${providerId}`).get()).data();
  const accountId = job.payoutAccountId || provider?.stripeAccountId;
  requireStripe();
  const current = await stripe.v2.core.accounts.retrieve(accountId, { include: ['configuration.recipient'] });
  if (current.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status !== 'active') throw new HttpError(409, 'Your mover must finish their payment setup to receive a tip.');
  const tip = await db.runTransaction(async tx => {
    const saved = (await tx.get(tipRef)).data();
    if (saved) {
      if (saved.status === 'paid') throw new HttpError(409, 'You already tipped this move. Thank you!');
      if (saved.amountCents !== cents || Date.now() - saved.startedAt.toMillis() > 23 * 3600000) throw new HttpError(409, 'A tip checkout already exists. Contact support if you need help.');
      return saved;
    }
    const next = { jobId, customerId: uid, providerId, accountId, amountCents: cents, providerCents: tipShareCents(cents), feePercent: 10, disclosureVersion: '2026-11-15', initiatedBy: uid, status: 'pending', startedAt: Timestamp.now() };
    tx.create(tipRef, next);
    return next;
  });
  const tag = createHash('sha256').update(jobId).digest('hex').slice(0, 8).replace(/[0-9a-f]/g, value => String.fromCharCode(97 + parseInt(value, 16)));
  const session = await stripe.checkout.sessions.create({ mode: 'payment', customer_email: email, integration_identifier: `wsm_tips_${tag}`, metadata: { flow: 'move_tip', jobId, customerId: uid }, line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: tip.amountCents, product_data: { name: 'Optional mover tip', description: `Mover receives $${(tip.providerCents / 100).toFixed(2)}. A 10% processing/platform fee is deducted from this tip.` } } }], success_url: `${origin}/dashboard/customer/moves/${jobId}?tip=received`, cancel_url: `${origin}/dashboard/customer/moves/${jobId}` }, { idempotencyKey: `tip-checkout-${jobId}` });
  await tipRef.update({ checkoutSessionId: session.id });
  return { url: session.url };
}

export async function confirmTipCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  const jobId = session.metadata?.jobId;
  if (!jobId) throw new HttpError(400, 'Tip is missing its move.');
  const db = adminDb(), ref = db.doc(`moveTips/${jobId}`);
  const tip = (await ref.get()).data();
  if (!tip || tip.customerId !== session.metadata?.customerId || (tip.checkoutSessionId && tip.checkoutSessionId !== session.id) || session.amount_total !== tip.amountCents || session.currency !== 'usd' || !session.payment_intent) throw new HttpError(409, 'Tip payment does not match.');
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
  await ref.update({ status: 'paid', checkoutSessionId: session.id, paymentIntentId: piId });
  await db.doc(`jobs/${jobId}`).update({ tipCents: tip.amountCents, tipProviderCents: tip.providerCents, tipPayoutStatus: 'processing' });
  // Failures return 500 to Stripe so the same durable transfer can be retried.
  const result = await moneyOperation(db, `tip-transfer-${jobId}`, { amount: tip.providerCents, currency: 'usd', destination: tip.accountId, metadata: { jobId, kind: 'tip' } }, async (request, key) => {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    if (!chargeId || !charge || pi.status !== 'succeeded' || charge.refunded || charge.disputed || charge.amount_refunded > 0) throw new Error('TIP_NOT_AVAILABLE_FOR_TRANSFER');
    const current = await stripe.v2.core.accounts.retrieve(String(request.destination), { include: ['configuration.recipient'] });
    if (current.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status !== 'active') throw new Error('TIP_RECIPIENT_NOT_READY');
    return stripe.transfers.create({ ...request, source_transaction: chargeId } as unknown as Stripe.TransferCreateParams, { idempotencyKey: key });
  });
  await ref.update({ transferId: result.id, payoutStatus: 'paid', paidAt: FieldValue.serverTimestamp() });
  await db.doc(`jobs/${jobId}`).update({ tipCents: tip.amountCents, tipProviderCents: tip.providerCents, tipPayoutStatus: 'paid' });
}
