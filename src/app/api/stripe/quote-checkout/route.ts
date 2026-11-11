import { NextResponse } from "next/server";
import { FieldValue } from 'firebase-admin/firestore';
import { stripe } from "@/lib/stripe";
import { calculateMoveTotal } from "@/lib/pricing";
import { zipRoadMiles } from "@/lib/server/distance";
import { adminDb } from "@/lib/server/firebase-admin";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe, siteOrigin } from "@/lib/server/auth";
import { requireCurrentTerms, bookingTermsAcceptance } from '@/lib/server/terms';
import { TERMS_VERSION } from '@/lib/terms';
import { customQuoteSchema } from '@/lib/custom-quotes';

/**
 * Pays for a quote. The move size, add-ons and discounts are read from the
 * customer's own quote on the server, and the total is calculated here.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["customer", "admin"]);
    const body = await readJson(req);
    requireCurrentTerms(body);
    const { quoteId } = body;
    if (!isId(quoteId)) throw new HttpError(400, "Choose a quote.");

    const quote = await adminDb().doc(`quotes/${quoteId}`).get();
    if (!quote.exists) throw new HttpError(404, "Quote not found.");
    const q = quote.data()!;
    if (q.customerId !== user.uid) throw new HttpError(403, "This quote belongs to another account.");
    if (q.status === "processed" || q.status === "expired") throw new HttpError(409, `This quote is ${q.status}.`);
    if (q.isCustomQuote && (!q.expiresAt || q.expiresAt.toMillis() <= Date.now())) throw new HttpError(409, 'This quote has expired.');
    if (q.isCustomQuote && q.pricing?.type !== 'fixed') throw new HttpError(409, 'Hourly estimates need a finalized fixed-price quote before payment.');
    if (q.isCustomQuote && !customQuoteSchema.safeParse({ name: q.name, email: q.email, description: q.description, pickupAddress: q.pickupAddress, dropoffAddress: q.dropoffAddress, moveDate: q.moveDate, expiresAt: q.expiresAt.toDate().toISOString(), pricing: q.pricing }).success) throw new HttpError(409, 'This quote needs review before payment.');

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
    const total = q.isCustomQuote ? q.pricing.total : calculateMoveTotal(moveSize, addOns, {
      isStudent: !!details.isStudent,
      isMilitary: !!details.isMilitary,
      isExpress: !!details.addOns?.express,
      // Distance from the quote's ZIP codes, worked out here (never trusted from the browser).
      miles: zipRoadMiles(q.pickupZip || details.pickupZip, q.dropoffZip || details.dropoffZip),
    });

    const origin = siteOrigin(req);
    requireStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: q.isCustomQuote ? 'Custom moving quote' : `${moveSize.toUpperCase()} Professional Move`,
              description: q.isCustomQuote ? q.description.slice(0, 500) : `Wont Stop Moving relocation with ${addOns.length} add-on${addOns.length === 1 ? "" : "s"}.`,
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
      if (!current || current.status === 'processed' || current.status === 'expired' || current.paymentStatus === 'paid' || (current.isCustomQuote && current.expiresAt.toMillis() <= Date.now())) throw new HttpError(409, 'This quote is no longer available.');
      const acceptance = bookingTermsAcceptance(user.uid);
      tx.set(db.doc(`checkoutTerms/${session.id}`), { customerId: user.uid, quoteId, termsAcceptance: acceptance });
      tx.update(quote.ref, { checkoutSessionId: session.id, paymentStatus: 'pending', paymentFailedAt: FieldValue.delete(), bookingTermsAcceptance: acceptance });
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
