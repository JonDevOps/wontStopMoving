import { randomInt } from 'node:crypto';
import type Stripe from 'stripe';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { HttpError, requireStripe } from './auth';
import { enqueueEmail } from './notifications';
import { stripe } from '@/lib/stripe';
import {
  MOVE_CREDIT_USD, formatGiftCode, giftCardAmount, isGiftCodeCore, newGiftCodeCore, normalizeGiftCode, type LedgerEntry,
} from '@/lib/rewards';

/**
 * Move-credit wallets (rewardWallets/{uid}) with a ledger
 * (rewardWallets/{uid}/ledger/{key}), and gift cards (giftCards/{code}).
 * All server-only: Firestore rules deny clients by default. Ledger entries use
 * a deterministic key, so every grant is applied at most once.
 */
const cents = (n: number) => Math.round(n * 100) / 100;
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const wallet = (uid: string) => adminDb().doc(`rewardWallets/${uid}`);

/** Adds (or with a negative amount, removes) credit inside a transaction. Returns false if `key` was already applied. */
export async function applyCredit(tx: Transaction, uid: string, amount: number, reason: string, key: string, extra: Record<string, unknown> = {}) {
  const ref = wallet(uid), entry = ref.collection('ledger').doc(key);
  const [w, e] = await Promise.all([tx.get(ref), tx.get(entry)]);
  if (e.exists) return false;
  const balance = cents(Number(w.data()?.balance || 0) + amount);
  if (balance < 0) throw new HttpError(409, 'Not enough credit.');
  tx.set(ref, { balance, updatedAt: FieldValue.serverTimestamp(), ...(amount > 0 ? { earnedTotal: FieldValue.increment(amount) } : {}) }, { merge: true });
  tx.create(entry, { amount: cents(amount), reason, createdAt: FieldValue.serverTimestamp(), ...extra });
  return true;
}

export async function getWallet(uid: string): Promise<{ balance: number; ledger: LedgerEntry[] }> {
  const ref = wallet(uid);
  const [w, ledger] = await Promise.all([ref.get(), ref.collection('ledger').orderBy('createdAt', 'desc').limit(50).get()]);
  return {
    balance: Number(w.data()?.balance || 0),
    ledger: ledger.docs.map(d => ({ id: d.id, amount: d.data().amount, reason: d.data().reason, createdAt: iso(d.data().createdAt) })),
  };
}

/** Thank-you credit when a move is completed. Never throws. */
export async function grantMoveCredit(jobId: string) {
  try {
    if (!(MOVE_CREDIT_USD > 0)) return;
    const db = adminDb();
    const job = (await db.doc(`jobs/${jobId}`).get()).data();
    if (!job?.customerId) return;
    const granted = await db.runTransaction(tx => applyCredit(tx, job.customerId, MOVE_CREDIT_USD, 'move-completed', `move-${jobId}`, { jobId }));
    if (!granted) return;
    const user = (await db.doc(`users/${job.customerId}`).get()).data();
    if (user?.email) {
      await enqueueEmail(`move-credit:${jobId}`, {
        category: 'rewards', referenceId: jobId, to: user.email,
        subject: `Thanks for moving with us: $${MOVE_CREDIT_USD} credit added`,
        text: `Hi ${user.name || 'there'},\n\nThanks for moving with Wont Stop Moving. We've added $${MOVE_CREDIT_USD} of move credit to your account. It's applied automatically when you book your next move, or you can gift it forward by referring a friend.\n\nSee your credit: https://wontstopmoving.com/dashboard/customer/rewards\n\nWont Stop Moving`,
      });
    }
  } catch (error) { console.error('Move credit failed', jobId, error); }
}

/** Gives back credit held for a checkout that expired unpaid. Never throws. */
export async function releaseCheckoutCredit(session: Stripe.Checkout.Session) {
  try {
    const amount = Number(session.metadata?.creditApplied || 0), uid = session.metadata?.customerId;
    if (!(amount > 0) || !uid || session.payment_status === 'paid') return;
    const held = wallet(uid).collection('ledger').doc(`checkout-${session.id}`);
    await adminDb().runTransaction(async tx => {
      // Only give back credit this checkout actually took.
      if (!(await tx.get(held)).exists) return;
      await applyCredit(tx, uid, amount, 'checkout-released', `release-${session.id}`, { sessionId: session.id });
    });
  } catch (error) { console.error('Credit release failed', session.id, error); }
}

// ---- Gift cards ----

export async function createGiftCardCheckout(opts: { uid: string; email: string; origin: string; amount: unknown; recipientName: unknown; recipientEmail: unknown; message: unknown; fromName: unknown }) {
  const amount = giftCardAmount(opts.amount);
  if (!amount) throw new HttpError(400, 'Choose an amount between $25 and $1,000.');
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const recipientEmail = text(opts.recipientEmail, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new HttpError(400, 'Enter the recipient’s email address.');
  requireStripe();
  const db = adminDb(), ref = db.collection('giftCardOrders').doc();
  await ref.set({
    buyerUid: opts.uid, buyerEmail: opts.email, amount, recipientEmail, recipientName: text(opts.recipientName, 120),
    fromName: text(opts.fromName, 120), message: text(opts.message, 500), status: 'pending', createdAt: FieldValue.serverTimestamp(),
  });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: opts.email,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount * 100, product_data: { name: `Wont Stop Moving gift card ($${amount})`, description: `Emailed to ${recipientEmail}. Never expires.` } } }],
    metadata: { type: 'giftcard', orderId: ref.id, customerId: opts.uid },
    success_url: `${opts.origin}/gift-cards?sent=1`,
    cancel_url: `${opts.origin}/gift-cards?cancelled=1`,
  });
  await ref.update({ checkoutSessionId: session.id });
  return { url: session.url };
}

/** Issues the card for a paid gift-card checkout (once) and emails it. */
export async function confirmGiftCardOrder(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new HttpError(400, 'Gift card payment is missing its order.');
  const db = adminDb(), orderRef = db.doc(`giftCardOrders/${orderId}`);
  const issued = await db.runTransaction(async (tx): Promise<Record<string, any> | null> => {
    const o = (await tx.get(orderRef)).data();
    if (!o) throw new HttpError(400, 'Gift card order not found.');
    if (o.buyerUid !== session.metadata?.customerId) throw new HttpError(400, 'Gift card order customer mismatch.');
    if (o.amount * 100 !== session.amount_total) throw new HttpError(400, 'Gift card amount mismatch.');
    if (o.status !== 'pending') return null;
    let core = '';
    for (let i = 0; i < 5 && !core; i++) {
      const c = newGiftCodeCore(randomInt);
      if (!(await tx.get(db.doc(`giftCards/${c}`))).exists) core = c;
    }
    if (!core) throw new Error('Could not create a gift card code.');
    tx.create(db.doc(`giftCards/${core}`), { amount: o.amount, status: 'active', orderId, buyerUid: o.buyerUid, recipientEmail: o.recipientEmail, createdAt: FieldValue.serverTimestamp() });
    tx.update(orderRef, { status: 'paid', paidAt: FieldValue.serverTimestamp(), code: core });
    return { ...o, core };
  });
  if (!issued) return;
  const code = formatGiftCode(issued.core);
  try {
    await enqueueEmail(`giftcard:${orderId}:recipient`, {
      category: 'giftcard', referenceId: orderId, to: issued.recipientEmail,
      subject: `${issued.fromName || 'Someone'} sent you a $${issued.amount} moving gift card`,
      text: `Hi ${issued.recipientName || 'there'},\n\n${issued.fromName || 'A friend'} sent you a $${issued.amount} Wont Stop Moving gift card.${issued.message ? `\n\n"${issued.message}"` : ''}\n\nYour code: ${code}\n\nTo use it, create a free account at https://wontstopmoving.com/signup and enter the code under Rewards in your dashboard. It becomes move credit for your next move and never expires.\n\nWont Stop Moving`,
    });
    await enqueueEmail(`giftcard:${orderId}:buyer`, {
      category: 'giftcard', referenceId: orderId, to: issued.buyerEmail,
      subject: `Your $${issued.amount} gift card was sent`,
      text: `Thanks! We emailed a $${issued.amount} Wont Stop Moving gift card to ${issued.recipientEmail}.\n\nGift card code (keep it in case they need it): ${code}\n\nWont Stop Moving`,
    });
  } catch (error) { console.error('Gift card emails failed', orderId, error); }
}

/** Moves a gift card's value into the customer's credit balance. */
export async function redeemGiftCard(uid: string, raw: unknown) {
  const core = normalizeGiftCode(raw);
  if (!isGiftCodeCore(core)) throw new HttpError(400, 'Enter the code from your gift card, like WSM-ABCD-EFGH.');
  const db = adminDb(), ref = db.doc(`giftCards/${core}`);
  return db.runTransaction(async tx => {
    const card = (await tx.get(ref)).data();
    if (!card) throw new HttpError(404, 'That gift card code wasn’t found.');
    if (card.status !== 'active') throw new HttpError(409, 'That gift card has already been used.');
    await applyCredit(tx, uid, card.amount, 'gift-card', `giftcard-${core}`, { giftCard: formatGiftCode(core) });
    tx.update(ref, { status: 'redeemed', redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp() });
    return { amount: card.amount as number };
  });
}
