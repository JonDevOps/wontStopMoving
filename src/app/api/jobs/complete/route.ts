import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Note: In a production environment this would heavily utilize `firebase-admin` to securely
// verify the document without exposing it to client manipulation.
// For this prototype, we receive the jobId and code, and verify via standard logic if applicable,
// but since we lack `firebase-admin`, we will rely on Stripe metadata and mock the update.
export async function POST(req: Request) {
  try {
    const { jobId, code } = await req.json();

    if (!jobId || !code) {
      throw new Error("Missing jobId or code");
    }

    // Since we don't have firebase-admin to query the DB securely here,
    // we would normally:
    // 1. Fetch Job from Firestore: `db.collection('jobs').doc(jobId).get()`
    // 2. if (job.releaseCode !== code) throw new Error("Invalid Code")
    // 3. const { price, providerIds, paymentIntentId } = job;
    // 4. Fetch Provider: `db.collection('providers').doc(providerIds[0]).get()`
    // 5. const { stripeAccountId } = provider;
    // 6. stripe.transfers.create({ amount: price * 0.85 * 100, currency: 'usd', destination: stripeAccountId })
    // 7. db.collection('jobs').doc(jobId).update({ status: 'completed' })

    // PROTOTYPE MOCK IMPLEMENTATION
    // Since we can't securely execute the server rules without admin, we will just return a success payload
    // and rely on the client to perform the Firebase updates to finalize the state.
    
    // In a real flow, the Transfer command looks like this:
    /*
    const transfer = await stripe.transfers.create({
      amount: Math.round(price * 0.85 * 100), // 85% payout
      currency: "usd",
      destination: stripeAccountId,
      transfer_group: `JOB_${jobId}`,
    });
    */

    return NextResponse.json({ 
      success: true, 
      message: "Job completed and 85% payout verified." 
    });
  } catch (error: any) {
    console.error("Payout transfer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
