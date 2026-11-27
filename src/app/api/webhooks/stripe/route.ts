import { updateBookingRefund } from '@/lib/server/booking-refunds';
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { confirmPaidCheckout, recordFailedCheckout } from "@/lib/server/jobs";
import { HttpError } from "@/lib/server/auth";
import { releaseCheckoutCredit, holdGiftCardPurchase } from "@/lib/server/rewards";
import { updateReviewRefund } from '@/lib/server/move-benefits';
import { adminDb } from '@/lib/server/firebase-admin';

/** Stripe webhook. Every event is signature-checked before anything is written. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const signature = req.headers.get("stripe-signature");
  if (!secret.startsWith("whsec_") || !signature) {
    return new NextResponse("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err: any) {
    console.error("Stripe webhook signature check failed:", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Platform Checkout payments only. Connected-account events use their own
  // endpoint and signing secret, and must not confirm platform bookings.
  if (event.account || event.livemode !== /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '')) {
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.expired") {
    await releaseCheckoutCredit(event.data.object as Stripe.Checkout.Session);
  }
  try {
    if (event.type === 'refund.updated' || event.type === 'refund.created' || event.type === 'refund.failed') { await updateReviewRefund(event.data.object as Stripe.Refund); await updateBookingRefund(event.data.object as Stripe.Refund); }
    if (event.type === 'charge.dispute.created' || event.type === 'charge.refunded') {
      const object = event.data.object as Stripe.Dispute | Stripe.Charge;
      const charge = event.type === 'charge.refunded' ? object as Stripe.Charge : null;
      const expectedIncentives = charge && !charge.refunds?.has_more && !!charge.refunds?.data.length && (await Promise.all(charge.refunds.data.map(async refund => {
        if (refund.metadata?.kind === 'review_refund') return refund.amount === 500 || (refund.metadata.reviewRefundTotal === '500' && refund.amount + Number(refund.metadata.giftRefundCents || 0) === 500);
        if (refund.metadata?.kind !== 'booking_cancellation' || !refund.metadata.jobId) return false;
        const job = (await adminDb().doc(`jobs/${refund.metadata.jobId}`).get()).data();
        return job?.status === 'cancelled' && (job.bookingRefundId === refund.id || event.request?.idempotency_key === `cancel-refund-${refund.metadata.jobId}`) && job.bookingRefundCardCents === refund.amount && job.paymentIntentId === (typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id);
      }))).every(Boolean);
      if (!expectedIncentives) {
        const intent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
        if (intent) {
          await holdGiftCardPurchase(intent, event.type);
          const jobs = await adminDb().collection('jobs').where('paymentIntentId', '==', intent).get();
          const batch = adminDb().batch();
          for (const job of jobs.docs) batch.update(job.ref, { paymentHold: true, paymentHoldReason: event.type });
          await batch.commit();
        }
      }
    }
  } catch { return new NextResponse('Retry later', { status: 500 }); }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      if (event.type === 'checkout.session.async_payment_failed') await recordFailedCheckout(session);
      else await confirmPaidCheckout(session);
    } catch (error) {
      // 4xx problems (unknown booking, wrong customer) will never succeed, so
      // acknowledge them; anything else returns 500 so Stripe retries.
      if (error instanceof HttpError && error.status < 500) {
        console.error(`Webhook ${event.id} ignored: ${error.message}`);
      } else {
        console.error(`Webhook ${event.id} failed:`, error);
        return new NextResponse("Retry later", { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}
