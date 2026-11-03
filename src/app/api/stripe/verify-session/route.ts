import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const isPlaceholder = !secretKey || secretKey.includes("placeholder");

    if (sessionId.startsWith("demo_session_") || isPlaceholder) {
      return NextResponse.json({
        paymentStatus: "paid",
        paymentIntentId: `pi_demo_${Date.now()}`,
        customerId: `cus_demo_${Date.now()}`,
        status: "complete",
        demo: true,
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({ 
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent,
      customerId: session.customer,
      status: session.status,
      metadata: session.metadata || {},
      amountTotal: session.amount_total ? session.amount_total / 100 : null,
    });
  } catch (error: any) {
    console.error("Stripe verify-session error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
