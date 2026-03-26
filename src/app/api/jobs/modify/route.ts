import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { jobId, amount, description, stripeCustomerId } = await req.json();

    if (!jobId || !amount || amount <= 0 || !stripeCustomerId) {
      return NextResponse.json({ error: "Invalid modification request. Required fields missing." }, { status: 400 });
    }

    // List the customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    if (paymentMethods.data.length === 0) {
      return NextResponse.json({ error: "No securely attached payment cards found for this job." }, { status: 400 });
    }

    // Charge the customer off-session
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // cents
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: paymentMethods.data[0].id,
      off_session: true,
      confirm: true,
      description: `Job Modification: ${description}`,
      metadata: {
        jobId,
        type: "modification"
      }
    });

    return NextResponse.json({ 
      success: true, 
      paymentIntentId: paymentIntent.id 
    });

  } catch (error: any) {
    console.error("Job Modification Error:", error);
    // if requires action (like SCA/3D secure), it will throw an error with code 'authentication_required'
    if (error.code === 'authentication_required') {
      return NextResponse.json({ 
        error: "The card requires authentication. We cannot auto-charge this method without the customer present.",
        clientReferenceId: error.payment_intent?.client_secret
      }, { status: 402 }); 
    }
    return NextResponse.json({ error: error.message || "Failed to modify job" }, { status: 500 });
  }
}
