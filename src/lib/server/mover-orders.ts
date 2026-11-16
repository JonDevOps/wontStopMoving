import { randomInt } from 'node:crypto';
import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { HttpError } from './auth';
import { notifyPaidJob } from './notifications';

/** One immutable allocation and one release code per cart item, even for the same provider. */
export async function confirmMoverOrder(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return { jobId: null };
  const db = adminDb(), ref = db.doc(`moverOrders/${session.metadata!.orderId}`);
  const ids = await db.runTransaction(async tx => {
    const order = (await tx.get(ref)).data();
    if (!order || order.customerId !== session.metadata?.customerId || (order.checkoutSessionId && order.checkoutSessionId !== session.id)) throw new HttpError(409, 'Checkout does not match this order.');
    if (session.currency !== 'usd' || session.amount_total !== order.totalCents || !session.payment_intent) throw new HttpError(409, 'Payment amount does not match this order.');
    const jobIds: string[] = order.items.map((item: { jobId: string }) => item.jobId);
    if (order.paymentStatus === 'paid') return jobIds;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
    const codes = new Set<string>();
    for (const item of order.items) {
      tx.create(db.doc(`jobs/${item.jobId}`), {
        id: item.jobId, orderId: ref.id, customerId: order.customerId, providerIds: [item.providerId], employeeIds: [],
        status: 'confirmed', paymentStatus: 'paid', checkoutSessionId: session.id, paymentIntentId,
        amountPaid: item.totalCents / 100, price: item.totalCents / 100, allocatedCents: item.totalCents,
        providerPayoutCents: item.providerPayoutCents, platformFeeCents: item.totalCents - item.providerPayoutCents,
        moveDate: item.moveDate, service: item.service, preferredStartTime: item.preferredStartTime,
        pickupAddress: item.pickupAddress, dropoffAddress: item.dropoffAddress, hoursReserved: item.hours,
        hourlyRate: item.hourlyRate, payoutAccountId: item.payoutAccountId,
        providerName: item.providerName,
        reviewRefundEligible: true, termsAcceptance: order.termsAcceptance,
        smsConsent: order.smsConsent === true, notificationPhone: order.smsConsent === true ? order.phone : '',
        createdAt: FieldValue.serverTimestamp(), paidAt: FieldValue.serverTimestamp(),
      });
      let code: string;
      do { code = String(randomInt(100000, 1000000)); } while (codes.has(code));
      codes.add(code);
      tx.create(db.doc(`jobSecrets/${item.jobId}`), { customerId: order.customerId, releaseCode: code, failedAttempts: 0 });
    }
    tx.update(ref, { paymentStatus: 'paid', checkoutSessionId: session.id, paymentIntentId, paidAt: FieldValue.serverTimestamp() });
    return jobIds;
  });
  for (const jobId of ids) await notifyPaidJob(jobId);
  return { jobId: ids[0] || null };
}
