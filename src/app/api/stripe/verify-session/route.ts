import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({ 
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent,
      status: session.status
    });
  } catch (error: any) {
    console.error("Stripe verify-session error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
