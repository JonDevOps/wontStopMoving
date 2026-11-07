import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { confirmPaidCheckout } from "@/lib/server/jobs";
import { errorResponse, getRole, HttpError, readJson, requireStripe, requireUser } from "@/lib/server/auth";

/** Called when the customer returns from Stripe. Only the paying customer (or an admin) can check a session. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    requireStripe();
    const { sessionId } = await readJson(req);
    if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
      throw new HttpError(400, "Invalid checkout session.");
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.customerId !== user.uid && (await getRole(user.uid)) !== "admin") {
      throw new HttpError(403, "This payment belongs to another account.");
    }
    const { jobId } = await confirmPaidCheckout(session);
    return NextResponse.json({ paymentStatus: session.payment_status, jobId });
  } catch (error) {
    return errorResponse(error);
  }
}
