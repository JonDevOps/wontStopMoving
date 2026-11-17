import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { adminDb } from './firebase-admin';
import { HttpError, requireStripe } from './auth';
import { bookingTermsAcceptance, requireCurrentTerms } from './terms';
import { moverCartSchema, providerShareCents, type MoverCartItem } from '../mover-cart';
import { validProviderPricing } from '../mover-pricing';
import { moverCity } from './mover-locations';
import { moverCityCenter, providerServesCity } from './mover-coverage';

export async function createMoverCheckout(uid: string, email: string | undefined, body: Record<string, unknown>, origin: string) {
  if (process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED !== 'true') throw new HttpError(503, 'Marketplace checkout is opening soon. Book our team directly or contact us for help.');
  requireCurrentTerms(body);
  const parsed = moverCartSchema.safeParse(body.items);
  if (!parsed.success) throw new HttpError(400, 'Check the providers, dates, addresses and hours in your cart.');
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)) throw new HttpError(400, 'Refresh your cart and try again.');
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (body.smsConsent === true && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new HttpError(400, 'Enter your mobile number with its country code for text updates.');
  const db = adminDb();
  const items: (MoverCartItem & { providerName: string; hourlyRate: number; totalCents: number; providerPayoutCents: number; payoutAccountId: string })[] = [];
  for (const item of parsed.data) {
    const place = moverCity(item.region, item.city);
    if (!place) throw new HttpError(400, 'Choose a supported service city.');
    if (item.moveDate < new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Choose today or a future date.');
    const p = (await db.doc(`providers/${item.providerId}`).get()).data();
    if (!p || p.status !== 'approved' || !validProviderPricing(p.hourlyRate, p.minimumHours) || p.stripeOnboardingComplete !== true || !/^acct_[A-Za-z0-9_]+$/.test(p.stripeAccountId || '')) throw new HttpError(409, 'A provider is no longer available. Update your cart.');
    if (!providerServesCity(p, item.region, item.city, moverCityCenter(item.region, place.city, item.city))) throw new HttpError(409, 'This provider does not cover the selected city. Choose a provider from your city results.');
    if (item.hours < p.minimumHours || !p.services?.includes(item.service === 'unloading' ? 'loading' : item.service)) throw new HttpError(409, 'The service or minimum hours changed. Update your cart.');
    if (item.quotedRate !== p.hourlyRate) throw new HttpError(409, 'A provider’s rate changed. Return to their booking page to review the new price.');
    if (p.unavailableDates?.includes(item.moveDate) || (Array.isArray(p.availableDays) && !p.availableDays.includes(new Date(`${item.moveDate}T12:00:00Z`).getUTCDay()))) throw new HttpError(409, 'A provider is unavailable on the selected date.');
    const totalCents = Math.round(p.hourlyRate * 100) * item.hours;
    items.push({ ...item, providerName: String(p.businessName || 'Moving provider').slice(0, 160), hourlyRate: p.hourlyRate, totalCents, providerPayoutCents: providerShareCents(totalCents), payoutAccountId: p.stripeAccountId });
  }
  requireStripe();
  // Check current recipient capabilities, not a stale onboarding flag, before taking payment.
  for (const account of new Set(items.map(item => item.payoutAccountId))) {
    const current = await stripe.v2.core.accounts.retrieve(account, { include: ['configuration.recipient'] });
    if (current.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status !== 'active') throw new HttpError(409, 'A provider must finish their payment setup before booking.');
  }
  const id = createHash('sha256').update(`${uid}:${body.requestId}`).digest('hex');
  const ref = db.doc(`moverOrders/${id}`);
  const fingerprint = createHash('sha256').update(JSON.stringify({ items: parsed.data, phone, consent: body.smsConsent === true })).digest('hex');
  const order = await db.runTransaction(async tx => {
    const saved = (await tx.get(ref)).data();
    if (saved) {
      if (saved.fingerprint !== fingerprint) throw new HttpError(409, 'Your cart changed. Refresh it before payment.');
      if (saved.paymentStatus === 'paid') throw new HttpError(409, 'This cart is already paid. Open your moves dashboard.');
      if (Date.now() - saved.startedAt.toMillis() > 23 * 3600000) throw new HttpError(409, 'This checkout expired. Refresh your cart.');
      return saved;
    }
    const next = { customerId: uid, fingerprint, items: items.map((item, index) => ({ ...item, jobId: `mover_${id}_${index}` })), totalCents: items.reduce((sum, item) => sum + item.totalCents, 0), paymentStatus: 'pending', termsAcceptance: bookingTermsAcceptance(uid), smsConsent: body.smsConsent === true, phone: body.smsConsent === true ? phone : '', startedAt: Timestamp.now() };
    tx.create(ref, next);
    return next;
  });
  const tag = id.slice(0, 8).replace(/[0-9a-f]/g, value => String.fromCharCode(97 + parseInt(value, 16)));
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: email, integration_identifier: `wsm_cart_${tag}`,
    line_items: order.items.map((item: { providerName: string; service: string; hours: number; totalCents: number }) => ({ quantity: 1, price_data: { currency: 'usd', unit_amount: item.totalCents, product_data: { name: `${item.providerName} · ${item.service}`, description: `${item.hours} hours. Release this crew’s payment code after their work is complete.` } } })),
    payment_intent_data: { transfer_group: `ORDER_${id}` },
    metadata: { flow: 'mover_cart', orderId: id, customerId: uid },
    success_url: `${origin}/dashboard/customer/moves?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/movers/cart?canceled=true`,
  }, { idempotencyKey: `mover-checkout-${id}` });
  await ref.update({ checkoutSessionId: session.id });
  return { url: session.url, orderId: id };
}
