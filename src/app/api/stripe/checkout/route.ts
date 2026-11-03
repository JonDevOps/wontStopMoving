import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { jobId, price, businessName, providerId } = await req.json();

    if (!jobId || !price || !businessName) {
      throw new Error("Missing required fields");
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9002";
    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const isPlaceholder = !secretKey || secretKey.includes("placeholder");

    if (isPlaceholder) {
      return NextResponse.json({
        url: `${origin}/dashboard/customer/moves?session_id=demo_session_${Date.now()}&job_id=${jobId}&demo=true`,
        demo: true,
      });
    }

    // Create Checkout Session
    // We capture the initial amount to the platform (Wont Stop Moving).
    // The funds are held in the platform's balance until the job is completed.
    // We save the payment method by defining `setup_future_usage`.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_creation: "always",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Moving Service with ${businessName}`,
              description: "Upfront escrow payment.",
            },
            unit_amount: price * 100, // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        jobId,
        providerId,
      },
      success_url: `${origin}/dashboard/customer/moves?session_id={CHECKOUT_SESSION_ID}&job_id=${jobId}`,
      cancel_url: `${origin}/book/${providerId}?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Session error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
