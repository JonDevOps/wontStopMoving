import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { confirmPaidCheckout } from "@/lib/server/jobs";
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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      await confirmPaidCheckout(event.data.object as Stripe.Checkout.Session);
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
