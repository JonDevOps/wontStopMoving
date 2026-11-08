import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { confirmPaidCheckout, recordFailedCheckout } from "@/lib/server/jobs";
import { HttpError } from "@/lib/server/auth";

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
  if (event.account || event.livemode !== (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_')) {
    return NextResponse.json({ received: true });
  }

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
