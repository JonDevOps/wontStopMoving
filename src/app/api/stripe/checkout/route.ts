import { creditBreakdown } from '@/lib/rewards';
import { getWallet, applyCredit } from '@/lib/server/rewards';
import { saveSmsConsent } from '@/lib/server/sms-consent';
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/server/firebase-admin";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe, siteOrigin } from "@/lib/server/auth";
import { requireCurrentTerms, bookingTermsAcceptance } from '@/lib/server/terms';
import { TERMS_VERSION } from '@/lib/terms';
import { validProviderPricing } from '@/lib/mover-pricing';
import { savedCardCustomer, SAVED_CARD_NOTE } from '@/lib/server/stripe-customer';

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
    const { providerId, moveDate, pickupAddress, dropoffAddress } = body;
    const hours = Number(body.hours);

    if (!isId(providerId)) throw new HttpError(400, "Choose a provider.");
    for (const [label, value] of [["move date", moveDate], ["pickup address", pickupAddress], ["drop-off address", dropoffAddress]] as const) {
      if (typeof value !== "string" || !value.trim() || value.length > 300) throw new HttpError(400, `Enter a valid ${label}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(moveDate)) || Number.isNaN(Date.parse(`${moveDate}T12:00:00Z`)) || new Date(`${moveDate}T12:00:00Z`).toISOString().slice(0,10) !== moveDate) throw new HttpError(400, 'Enter a valid move date.');

    const db = adminDb();
    const provider = await db.doc(`providers/${providerId}`).get();
    if (!provider.exists) throw new HttpError(404, "Provider not found.");
    const p = provider.data()!;
    if (p.status !== 'approved' || p.stripeOnboardingComplete !== true || typeof p.stripeAccountId !== 'string' || !p.stripeAccountId.startsWith('acct_')) throw new HttpError(409, "This provider isn't taking bookings.");
    if (!validProviderPricing(p.hourlyRate, p.minimumHours)) throw new HttpError(409, 'This provider must update their pricing before booking. Rates start at $45/hour with a two-hour minimum.');

    const minimumHours = p.minimumHours;
    if (!Number.isInteger(hours) || hours < minimumHours || hours > 24) {
      throw new HttpError(400, `Book between ${minimumHours} and 24 hours.`);
    }
    const rate = p.hourlyRate;
    const price = Math.round(hours * rate * 100) / 100;
    const service = typeof body.service === 'string' ? body.service : 'loading';
    const preferredStartTime = typeof body.preferredStartTime === 'string' ? body.preferredStartTime : '';
    if (!['loading', 'unloading', 'packing', 'cleaning', 'heavy'].includes(service)) throw new HttpError(400, 'Choose a supported service.');
    if (body.service && (!Array.isArray(p.services) || !p.services.includes(service === 'unloading' ? 'loading' : service))) throw new HttpError(409, 'This provider does not offer that service.');
    if (preferredStartTime && !['morning', 'afternoon', 'evening'].includes(preferredStartTime)) throw new HttpError(400, 'Choose a preferred start time.');
    if ((Array.isArray(p.unavailableDates) && p.unavailableDates.includes(moveDate)) || (Array.isArray(p.availableDays) && !p.availableDays.includes(new Date(`${moveDate}T12:00:00Z`).getUTCDay()))) throw new HttpError(409, 'This provider is unavailable on that date.');
    if (typeof body.smsConsent === 'boolean') await saveSmsConsent({subject:`user:${user.uid}`,customerId:user.uid,phone:body.phone,consent:body.smsConsent,version:body.smsDisclosureVersion,source:'provider_checkout',sourcePage:body.smsSourcePage});
    requireStripe();

    const balances = body.useCredit !== false ? await getWallet(user.uid) : { balance: 0, giftBalance: 0 };
    const funding = creditBreakdown(price, balances.giftBalance, balances.giftBalance);
    const jobRef = db.collection("jobs").doc();
    await jobRef.set({
      id: jobRef.id,
      customerId: user.uid,
      providerIds: [providerId],
      providerName: String(p.businessName || "Your crew").slice(0, 80),
      employeeIds: [],
      status: "pending_payment",
      paymentStatus: "unpaid",
      moveDate: (moveDate as string).trim(),
      pickupAddress: (pickupAddress as string).trim(),
      dropoffAddress: (dropoffAddress as string).trim(),
      hoursReserved: hours,
      hourlyRate: rate,
      service,
      preferredStartTime,
      price,
      createdAt: FieldValue.serverTimestamp(),
      termsAcceptance: bookingTermsAcceptance(user.uid),
    });

    const origin = siteOrigin(req);
    // Save the card so the customer can approve extra hours later (#153).
    const stripeCustomerId = await savedCardCustomer(user.uid, user.email);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      custom_text: { submit: { message: SAVED_CARD_NOTE } },
      payment_intent_data: { setup_future_usage: "off_session", transfer_group: `JOB_${jobRef.id}` },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Moving Service with ${String(p.businessName || "your provider").slice(0, 80)}`,
              description: `${hours} hours. Released to your mover after the job is done.`,
            },
            unit_amount: Math.round((price - funding.credit) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { flow: "booking", jobId: jobRef.id, customerId: user.uid, providerId, termsVersion: TERMS_VERSION, creditApplied: funding.credit.toFixed(2) },
      ...(funding.credit ? { expires_at: Math.floor(Date.now() / 1000) + 3600 } : {}),
      success_url: `${origin}/dashboard/customer/moves?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book/${providerId}?canceled=true`,
    });
    try {
    await db.runTransaction(async tx => {
      if (funding.credit) await applyCredit(tx, user.uid, -funding.credit, 'checkout', `checkout-${session.id}`, { sessionId: session.id, jobId: jobRef.id, giftApplied: funding.gift });
      tx.set(db.doc(`checkoutTerms/${session.id}`), { customerId: user.uid, jobId: jobRef.id, totalCents: Math.round(price * 100), creditApplied: funding.credit, giftApplied: funding.gift });
      tx.update(jobRef, { checkoutSessionId: session.id, creditApplied: funding.credit, giftApplied: funding.gift, creditLedgerKey: funding.credit ? `checkout-${session.id}` : null });
    });
    } catch(error) { await stripe.checkout.sessions.expire(session.id).catch(() => {}); throw error; }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
