import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/server/firebase-admin";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe, siteOrigin } from "@/lib/server/auth";
import { requireCurrentTerms, bookingTermsAcceptance } from '@/lib/server/terms';
import { TERMS_VERSION } from '@/lib/terms';

const DEFAULT_HOURLY_RATE = 50;

/**
 * Starts a provider booking. The job and its price are created here on the
 * server from the provider's own rate; nothing about the price comes from the
 * browser.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["customer", "admin"]);
    const body = await readJson(req);
    requireCurrentTerms(body);
    requireStripe();
    const { providerId, moveDate, pickupAddress, dropoffAddress } = body;
    const hours = Number(body.hours);

    if (!isId(providerId)) throw new HttpError(400, "Choose a provider.");
    for (const [label, value] of [["move date", moveDate], ["pickup address", pickupAddress], ["drop-off address", dropoffAddress]] as const) {
      if (typeof value !== "string" || !value.trim() || value.length > 300) throw new HttpError(400, `Enter a valid ${label}.`);
    }

    const db = adminDb();
    const provider = await db.doc(`providers/${providerId}`).get();
    if (!provider.exists) throw new HttpError(404, "Provider not found.");
    const p = provider.data()!;
    if (p.status === "suspended") throw new HttpError(409, "This provider isn't taking bookings.");

    const minimumHours = Math.max(1, Math.min(24, Math.floor(Number(p.minimumHours) || 2)));
    if (!Number.isInteger(hours) || hours < minimumHours || hours > 24) {
      throw new HttpError(400, `Book between ${minimumHours} and 24 hours.`);
    }
    const rate = Number(p.hourlyRate) > 0 && Number(p.hourlyRate) <= 1000 ? Number(p.hourlyRate) : DEFAULT_HOURLY_RATE;
    const price = Math.round(hours * rate * 100) / 100;

    const jobRef = db.collection("jobs").doc();
    await jobRef.set({
      id: jobRef.id,
      customerId: user.uid,
      providerIds: [providerId],
      employeeIds: [],
      status: "pending_payment",
      paymentStatus: "unpaid",
      moveDate: (moveDate as string).trim(),
      pickupAddress: (pickupAddress as string).trim(),
      dropoffAddress: (dropoffAddress as string).trim(),
      hoursReserved: hours,
      price,
      createdAt: FieldValue.serverTimestamp(),
      termsAcceptance: bookingTermsAcceptance(user.uid),
    });

    const origin = siteOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Moving Service with ${String(p.businessName || "your provider").slice(0, 80)}`,
              description: `${hours} hours, held in escrow until the job is done.`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { flow: "booking", jobId: jobRef.id, customerId: user.uid, providerId, termsVersion: TERMS_VERSION },
      success_url: `${origin}/dashboard/customer/moves?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book/${providerId}?canceled=true`,
    });
    await jobRef.update({ checkoutSessionId: session.id });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
