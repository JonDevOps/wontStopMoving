import { NextResponse } from "next/server";
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from "@/lib/stripe";
import { calculateMoveTotal } from "@/lib/pricing";
import { adminDb } from "@/lib/server/firebase-admin";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe, siteOrigin } from "@/lib/server/auth";
import { requireCurrentTerms, bookingTermsAcceptance } from '@/lib/server/terms';
import { TERMS_VERSION } from '@/lib/terms';

/**
 * Pays for a quote. The move size, add-ons and discounts are read from the
 * customer's own quote on the server, and the total is calculated here.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["customer", "admin"]);
    const body = await readJson(req);
    requireCurrentTerms(body);
    requireStripe();
    const { quoteId } = body;
    if (!isId(quoteId)) throw new HttpError(400, "Choose a quote.");

    const quote = await adminDb().doc(`quotes/${quoteId}`).get();
    if (!quote.exists) throw new HttpError(404, "Quote not found.");
    const q = quote.data()!;
    if (q.customerId !== user.uid) throw new HttpError(403, "This quote belongs to another account.");
    if (q.status === "processed" || q.status === "expired") throw new HttpError(409, `This quote is ${q.status}.`);

    let details: Record<string, any> = {};
    try {
      details = typeof q.details === "string" ? JSON.parse(q.details) : q.details || {};
    } catch {
      details = {};
    }
    const moveSize = String(q.moveSize || details.moveSize || "studio");
    const addOns = Object.entries(details.addOns || {})
      .filter(([, active]) => active)
      .map(([key]) => key);
    const total = calculateMoveTotal(moveSize, addOns, {
      isStudent: !!details.isStudent,
      isMilitary: !!details.isMilitary,
      isExpress: !!details.addOns?.express,
    });

    const origin = siteOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${moveSize.toUpperCase()} Professional Move`,
              description: `Wont Stop Moving relocation with ${addOns.length} add-on${addOns.length === 1 ? "" : "s"}.`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { flow: "quote", quoteId, customerId: user.uid, moveSize, termsVersion: TERMS_VERSION },
      success_url: `${origin}/dashboard/customer/moves?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/customer/quotes?cancelled=true`,
    });
    const db = adminDb();
    await db.runTransaction(async tx => {
      const current = (await tx.get(quote.ref)).data();
      if (!current || current.status === 'processed' || current.paymentStatus === 'paid') throw new HttpError(409, 'This quote has already been booked.');
      const acceptance = bookingTermsAcceptance(user.uid);
      tx.set(db.doc(`checkoutTerms/${session.id}`), { customerId: user.uid, quoteId, termsAcceptance: acceptance });
      tx.update(quote.ref, { checkoutSessionId: session.id, paymentStatus: 'pending', paymentFailedAt: FieldValue.delete(), bookingTermsAcceptance: acceptance });
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
