import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { HttpError, requireStripe } from './auth';
import { enqueueEmail } from './notifications';
import { stripe } from '@/lib/stripe';
import { FULFILLMENT, priceCart, SALES_TAX_RATE, type Fulfillment } from '@/lib/shop';

/**
 * Supplies shop orders in shopOrders/{id} (server-only). The cart is priced
 * here, paid through Stripe Checkout, and confirmed by the same paths as
 * bookings (webhook or the return page), idempotently.
 */
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function createShopCheckout(opts: { uid: string; email: string; origin: string; items: unknown; fulfillment: unknown; jobId?: unknown; notes?: unknown }) {
  const fulfillment = (Object.keys(FULFILLMENT) as Fulfillment[]).find(f => f === opts.fulfillment);
  if (!fulfillment) throw new HttpError(400, 'Choose how you’d like to get your supplies.');
  const cart = priceCart(opts.items, fulfillment);
  if (!cart) throw new HttpError(400, 'Your cart is empty.');
  const db = adminDb();
  let jobId: string | null = null;
  if (fulfillment === 'with-move') {
    if (typeof opts.jobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(opts.jobId)) throw new HttpError(400, 'Choose the move to bring your supplies with.');
    const job = (await db.doc(`jobs/${opts.jobId}`).get()).data();
    if (!job || job.customerId !== opts.uid || ['completed', 'cancelled'].includes(job.status)) throw new HttpError(400, 'That move isn’t available. Choose delivery or pickup instead.');
    jobId = opts.jobId;
  }
  requireStripe();
  const ref = db.collection('shopOrders').doc();
  await ref.set({
    customerId: opts.uid, email: opts.email, status: 'pending', fulfillment, jobId, lines: cart.lines, subtotal: cart.subtotal, delivery: cart.delivery,
    tax: cart.tax, taxRate: SALES_TAX_RATE, total: cart.total, notes: typeof opts.notes === 'string' ? opts.notes.trim().slice(0, 500) : '', createdAt: FieldValue.serverTimestamp(),
  });
  const line = (name: string, amount: number, qty = 1) => ({ quantity: qty, price_data: { currency: 'usd', unit_amount: Math.round(amount * 100), product_data: { name } } });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: opts.email,
    line_items: [
      ...cart.lines.map(l => line(l.name, l.price, l.qty)),
      ...(cart.delivery ? [line('Delivery', cart.delivery)] : []),
      line(`Sales tax (${(SALES_TAX_RATE * 100).toFixed(3).replace(/0+$/, '')}%)`, cart.tax),
    ],
    ...(fulfillment === 'delivery' ? { shipping_address_collection: { allowed_countries: ['US'] }, phone_number_collection: { enabled: true } } : {}),
    metadata: { type: 'shop', orderId: ref.id, customerId: opts.uid },
    success_url: `${opts.origin}/shop/order/${ref.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/shop?cancelled=1`,
  });
  await ref.update({ checkoutSessionId: session.id });
  return { url: session.url, orderId: ref.id };
}

/** Marks a shop order paid (once) and emails the team and the customer. */
export async function confirmShopOrder(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new HttpError(400, 'Shop payment is missing its order.');
  const db = adminDb(), ref = db.doc(`shopOrders/${orderId}`);
  const order = await db.runTransaction(async tx => {
    const o = (await tx.get(ref)).data();
    if (!o) throw new HttpError(400, 'Shop order not found.');
    if (o.customerId !== session.metadata?.customerId) throw new HttpError(400, 'Shop order customer mismatch.');
    if (Math.round(o.total * 100) !== session.amount_total) throw new HttpError(400, 'Shop order amount mismatch.');
    if (o.status !== 'pending') return null;
    const shipping = (session as any).collected_information?.shipping_details || (session as any).shipping_details || null;
    tx.update(ref, { status: 'paid', paidAt: FieldValue.serverTimestamp(), paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null, shipping: shipping ? { name: shipping.name || '', address: shipping.address || null } : null, phone: session.customer_details?.phone || null });
    return o;
  });
  if (!order) return;
  const list = order.lines.map((l: { qty: number; name: string; total: number }) => `${l.qty} × ${l.name}  $${l.total.toFixed(2)}`).join('\n');
  const how = FULFILLMENT[order.fulfillment as Fulfillment]?.label || order.fulfillment;
  try {
    await enqueueEmail(`shop-order:${orderId}:admin`, { category: 'shop', referenceId: orderId, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org', subject: `New supplies order: $${order.total.toFixed(2)} (${how})`, text: `A supplies order was paid.\n\n${list}\nTotal: $${order.total.toFixed(2)}\nFulfillment: ${how}${order.jobId ? ` (move ${order.jobId})` : ''}\n${order.notes ? `Notes: ${order.notes}\n` : ''}\nOpen shop orders:\nhttps://wontstopmoving.com/dashboard/admin/shop\n\nWont Stop Moving` });
    await enqueueEmail(`shop-order:${orderId}:customer`, { category: 'shop', referenceId: orderId, to: order.email, subject: 'Your moving supplies order is confirmed', text: `Thanks for your order!\n\n${list}\nTotal paid: $${order.total.toFixed(2)}\n\n${FULFILLMENT[order.fulfillment as Fulfillment]?.note || ''}\n\nTrack it: https://wontstopmoving.com/shop/order/${orderId}\n\nQuestions? Call (415) 214-5474.\n\nWont Stop Moving` });
  } catch (error) { console.error('Shop order emails failed', orderId, error); }
}

export const orderView = (id: string, o: FirebaseFirestore.DocumentData) => ({
  id, status: o.status, fulfillment: o.fulfillment, jobId: o.jobId || null, lines: o.lines || [], subtotal: o.subtotal, delivery: o.delivery, tax: o.tax, total: o.total,
  notes: o.notes || '', email: o.email, phone: o.phone || null, shipping: o.shipping || null, adminNote: o.adminNote || '', createdAt: iso(o.createdAt), paidAt: iso(o.paidAt), updatedAt: iso(o.updatedAt),
});
