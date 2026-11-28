import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { adminDb } from './firebase-admin';
import { HttpError } from './auth';
import { enqueueEmail } from './notifications';
import { moneyOperation } from './money-operation';
import { providerShareCents } from '../mover-cart';

/**
 * Extra hours on a marketplace job (#153). The crew asks for more hours; the
 * customer accepts in the app and the extra hours are charged right away to
 * the card saved at checkout. The crew's share of each extra charge is paid
 * out with the job, from that charge (see payExtraCharges).
 */
const ORIGIN = 'https://wontstopmoving.com';
export type HoursRequest = { id: string; hours: number; fromHours: number; extraCents: number; reason: string; requestedBy: string; requestedAt: number; status: 'pending' | 'accepted' | 'declined' | 'payment_failed'; respondedAt?: number; chargeId?: string; error?: string };

export async function requestExtraHours(p: { jobId: string; uid: string; isAdmin: boolean; hours: unknown; reason: unknown }) {
  const db = adminDb(), ref = db.doc(`jobs/${p.jobId}`);
  const hours = Number(p.hours), reason = typeof p.reason === 'string' ? p.reason.trim().slice(0, 300) : '';
  const request = await db.runTransaction(async tx => {
    const job = (await tx.get(ref)).data();
    if (!job) throw new HttpError(404, 'Job not found.');
    if (!p.isAdmin && !(Array.isArray(job.providerIds) && job.providerIds.includes(p.uid))) throw new HttpError(403, 'You are not assigned to this job.');
    if (job.paymentStatus !== 'paid' || job.paymentHold || !['confirmed', 'in-progress'].includes(job.status)) throw new HttpError(409, 'Hours can only change on a paid job that isn’t finished.');
    // Book Now jobs created before hourlyRate was stored: price / hours is the rate.
    const from = Number(job.hoursReserved), rate = Number(job.hourlyRate ?? Number(job.price) / from);
    if (!Number.isFinite(from) || !Number.isFinite(rate) || rate <= 0) throw new HttpError(409, 'This job’s hours can’t be changed here. Contact support.');
    if (!Number.isInteger(hours) || hours <= from || hours > 24) throw new HttpError(400, `Choose a whole number of hours above ${from} (up to 24).`);
    if (!reason) throw new HttpError(400, 'Tell the customer why more time is needed.');
    const next: HoursRequest = { id: randomUUID(), hours, fromHours: from, extraCents: Math.round(rate * 100) * (hours - from), reason, requestedBy: p.uid, requestedAt: Date.now(), status: 'pending' };
    tx.update(ref, { hoursRequest: next });
    return { next, customerId: job.customerId as string, providerName: String(job.providerName || 'Your crew') };
  });
  const customer = (await db.doc(`users/${request.customerId}`).get()).data();
  if (customer?.email) {
    await enqueueEmail(`extra-hours:${p.jobId}:${request.next.id}`, {
      to: customer.email, category: 'job', referenceId: p.jobId, subject: `${request.providerName} asked for more time on your move`,
      text: `${request.providerName} asked to change your booking from ${request.next.fromHours} to ${request.next.hours} hours.\nReason: ${request.next.reason}\nExtra cost: $${(request.next.extraCents / 100).toFixed(2)}\n\nAccept or decline here:\n${ORIGIN}/dashboard/customer/moves/${p.jobId}\n\nIf you accept, the card you paid with is charged right away.`,
    }).catch(() => null);
  }
  return request.next;
}

/** The customer's saved card from the job's original payment. */
async function savedCard(paymentIntentId: string) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const customer = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
  const paymentMethod = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id;
  if (!customer || !paymentMethod || pi.setup_future_usage !== 'off_session') return null;
  return { customer, paymentMethod };
}

export async function respondExtraHours(p: { jobId: string; uid: string; accept: boolean }) {
  const db = adminDb(), ref = db.doc(`jobs/${p.jobId}`);
  const job = (await ref.get()).data();
  if (!job) throw new HttpError(404, 'Move not found.');
  if (job.customerId !== p.uid) throw new HttpError(403, 'This move belongs to another account.');
  const req = job.hoursRequest as HoursRequest | undefined;
  if (!req || (req.status !== 'pending' && req.status !== 'payment_failed')) throw new HttpError(409, 'There’s no hours change waiting for you.');
  if (!p.accept) {
    await ref.update({ 'hoursRequest.status': 'declined', 'hoursRequest.respondedAt': Date.now() });
    return { status: 'declined' as const };
  }
  if (job.status === 'completed' || job.status === 'cancelled' || job.paymentHold) throw new HttpError(409, 'This move can’t be changed now. Contact support.');
  const card = job.paymentIntentId ? await savedCard(job.paymentIntentId) : null;
  if (!card) throw new HttpError(409, 'There’s no saved card for this booking. Contact support to pay for the extra time.');
  let intent: { id: string; status?: string | null };
  try {
    intent = await moneyOperation(db, `extra-hours-${p.jobId}-${req.id}`, {
      amount: req.extraCents, currency: 'usd', customer: card.customer, payment_method: card.paymentMethod,
      off_session: true, confirm: true, description: `Extra hours for move ${p.jobId}`,
      metadata: { flow: 'extra_hours', jobId: p.jobId, requestId: req.id },
    }, (request, key) => stripe.paymentIntents.create(request as unknown as Stripe.PaymentIntentCreateParams, { idempotencyKey: key }));
  } catch (error) {
    const message = (error as { code?: string }).code === 'authentication_required' ? 'Your bank needs you to confirm this charge. Contact support and we’ll send a secure payment link.' : 'Your card was declined. Contact support to pay for the extra time.';
    await ref.update({ 'hoursRequest.status': 'payment_failed', 'hoursRequest.error': message, 'hoursRequest.respondedAt': Date.now() });
    throw new HttpError(402, message);
  }
  if (intent.status !== 'succeeded') {
    await ref.update({ 'hoursRequest.status': 'payment_failed', 'hoursRequest.error': 'Payment didn’t complete.', 'hoursRequest.respondedAt': Date.now() });
    throw new HttpError(402, 'Payment didn’t complete. Contact support to pay for the extra time.');
  }
  const pi = await stripe.paymentIntents.retrieve(intent.id);
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data()!;
    if ((current.hoursRequest as HoursRequest).status === 'accepted') return;
    const providerCents = providerShareCents(req.extraCents);
    tx.update(ref, {
      hoursReserved: req.hours,
      amountPaid: Number(current.amountPaid || 0) + req.extraCents / 100,
      price: Number(current.price || 0) + req.extraCents / 100,
      extraCharges: FieldValue.arrayUnion({ requestId: req.id, paymentIntentId: intent.id, chargeId: chargeId || null, cents: req.extraCents, providerCents, hours: req.hours - req.fromHours, at: Date.now() }),
      'hoursRequest.status': 'accepted', 'hoursRequest.respondedAt': Date.now(), 'hoursRequest.chargeId': chargeId || null,
    });
  });
  return { status: 'accepted' as const, chargedCents: req.extraCents };
}

/** Pays the crew's share of each extra-hours charge, from that charge. Safe to call again. */
export async function payExtraCharges(jobId: string, destination: string) {
  const db = adminDb(), ref = db.doc(`jobs/${jobId}`);
  const job = (await ref.get()).data();
  const charges: { requestId: string; chargeId: string | null; providerCents: number; transferId?: string }[] = Array.isArray(job?.extraCharges) ? job!.extraCharges : [];
  let allPaid = true;
  const updated = [];
  for (const c of charges) {
    if (c.transferId || !c.chargeId || !(c.providerCents > 0)) { updated.push(c); allPaid = allPaid && (!!c.transferId || !(c.providerCents > 0)); continue; }
    try {
      const t = await moneyOperation(db, `payout-${jobId}-extra-${c.requestId}`, {
        amount: c.providerCents, currency: 'usd', destination, source_transaction: c.chargeId,
        description: `85% of extra hours for job ${jobId}`, metadata: { jobId, requestId: c.requestId },
      }, (request, key) => stripe.transfers.create(request as unknown as Stripe.TransferCreateParams, { idempotencyKey: key }));
      updated.push({ ...c, transferId: t.id });
    } catch {
      allPaid = false; updated.push(c);
      console.error(`Extra-hours payout for job ${jobId} needs manual review.`);
    }
  }
  if (charges.length) await ref.update({ extraCharges: updated, extraPayoutStatus: allPaid ? 'paid' : 'needs_manual_payout' });
  return allPaid;
}
