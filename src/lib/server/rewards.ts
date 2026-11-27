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

/** Derive legacy gift value from its ledger without changing the customer's total balance. */
export async function readWallet(tx: Transaction, uid: string) {
  const ref = wallet(uid), snapshot = await tx.get(ref), data = snapshot.data();
  const balance = Math.max(0, cents(Number(data?.balance || 0)));
  if (typeof data?.giftBalance === 'number') return { balance, giftBalance: Math.min(balance, Math.max(0, cents(data.giftBalance))), paymentHold: data?.paymentHold === true };
  const history = await tx.get(ref.collection('ledger'));
  const entries = history.docs.map(d => ({id: d.id, ...d.data()} as Record<string, any>)).sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id));
  let gifts = 0;
  const spent = new Map<string, number>();
  for (const e of entries) {
    const amount = cents(Number(e.amount || 0));
    if (e.reason === 'gift-card' || e.reason === 'gift-refund' || e.reason === 'review-gift-refund') gifts += amount;
    else if (amount < 0) { const used = Math.min(gifts, -amount); gifts -= used; spent.set(e.sessionId || e.id.replace(/^checkout-/, ''), used); }
    else if (e.reason === 'checkout-released') gifts += Math.min(amount, spent.get(e.sessionId || e.id.replace(/^release-/, '')) || 0);
  }
  return { balance, giftBalance: Math.min(balance, Math.max(0, cents(gifts))), paymentHold: data?.paymentHold === true };
}

/** Atomic, idempotent ledger mutation with separate prepaid and promotional balances. */
export async function applyCredit(tx: Transaction, uid: string, amount: number, reason: string, key: string, extra: Record<string, unknown> = {}) {
  const ref = wallet(uid), entry = ref.collection('ledger').doc(key);
  const e = await tx.get(entry);
  if (e.exists) return false;
  const current = await readWallet(tx, uid);
  if (amount < 0 && current.paymentHold) throw new HttpError(409, 'Your credit balance needs payment review. Contact support.');
  const balance = cents(current.balance + amount);
  if (balance < 0) throw new HttpError(409, 'Not enough credit.');
  const giftChange = amount < 0 ? -Number(extra.giftApplied ?? Math.min(current.giftBalance, -amount)) :
    ['gift-card','gift-refund','review-gift-refund'].includes(reason) ? amount : Number(extra.giftReturned || 0);
  const giftBalance = cents(current.giftBalance + giftChange);
  if (giftBalance < 0 || giftBalance > balance || !Number.isFinite(giftBalance)) throw new HttpError(409, 'Your credit balance changed. Please try again.');
  tx.set(ref, { balance, giftBalance, updatedAt: FieldValue.serverTimestamp(), ...(amount > 0 ? { earnedTotal: FieldValue.increment(amount) } : {}) }, { merge: true });
  tx.create(entry, { ...extra, amount: cents(amount), reason, giftApplied: amount < 0 ? -giftChange : 0, giftReturned: amount > 0 ? giftChange : 0, createdAt: FieldValue.serverTimestamp() });
  return true;
}

export async function getWallet(uid: string): Promise<{ balance: number; giftBalance: number; rewardBalance: number; ledger: LedgerEntry[] }> {
  const balances = await adminDb().runTransaction(tx => readWallet(tx, uid));
  const ledger = await wallet(uid).collection('ledger').orderBy('createdAt', 'desc').limit(50).get();
  return { ...balances, rewardBalance: cents(balances.balance - balances.giftBalance), ledger: ledger.docs.map(d => ({ id: d.id, amount: d.data().amount, reason: d.data().reason, createdAt: iso(d.data().createdAt) })) };
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

/** Restore the exact held tenders once. Failures propagate so Stripe retries. */
export async function releaseCheckoutCredit(session: Stripe.Checkout.Session) {
  try {
    const uid = session.metadata?.customerId;
    if (!uid || session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return;
    const db = adminDb();
    await db.runTransaction(async tx => {
      const orderRef = session.metadata?.flow === 'mover_cart' && session.metadata.orderId ? db.doc(`moverOrders/${session.metadata.orderId}`) : null;
      const order = orderRef ? (await tx.get(orderRef)).data() : null;
      if (orderRef && (!order || order.customerId !== uid || order.paymentStatus === 'paid' || order.checkoutSessionId !== session.id)) return;
      const jobRef = !orderRef && session.metadata?.flow === 'booking' && session.metadata.jobId ? db.doc(`jobs/${session.metadata.jobId}`) : !orderRef && session.metadata?.quoteId ? db.doc(`jobs/job_quote_${session.metadata.quoteId}`) : null;
      const job = jobRef ? (await tx.get(jobRef)).data() : null;
      if (job?.paymentStatus === 'paid' && job.checkoutSessionId === session.id) return;
      const key = orderRef ? `checkout-order-${orderRef.id}` : `checkout-${session.id}`;
      const held = (await tx.get(wallet(uid).collection('ledger').doc(key))).data();
      if (!held || !(Number(held.amount) < 0)) { if (orderRef) tx.update(orderRef, { paymentStatus: 'expired' }); return; }
      const amount = -Number(held.amount);
      await applyCredit(tx, uid, amount, 'checkout-released', orderRef ? `release-${key}` : `release-${session.id}`, { sessionId: session.id, giftReturned: Number(held.giftApplied || 0) });
      if (orderRef) tx.update(orderRef, { paymentStatus: 'expired' });
    });
  } catch (error) { console.error('Credit release failed', session.id, error); throw error; }
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
    tx.update(orderRef, { status: 'paid', paidAt: FieldValue.serverTimestamp(), code: core, paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null });
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
    const source = card.orderId ? (await tx.get(db.doc(`giftCardOrders/${card.orderId}`))).data() : null;
    if (source?.paymentHold) throw new HttpError(409, 'This gift card needs payment review. Contact support.');
    if (card.status !== 'active') throw new HttpError(409, 'That gift card has already been used.');
    await applyCredit(tx, uid, card.amount, 'gift-card', `giftcard-${core}`, { giftCard: formatGiftCode(core) });
    tx.update(ref, { status: 'redeemed', redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp() });
    return { amount: card.amount as number };
  });
}

/** Proof of credit actually held by this checkout, not a claim from Stripe metadata. */
export async function checkoutCreditHeld(tx: Transaction, uid: string, key: string, amount: number) {
  const entry = (await tx.get(wallet(uid).collection('ledger').doc(key))).data();
  const released = (await tx.get(wallet(uid).collection('ledger').doc(key.startsWith('checkout-order-') ? `release-${key}` : `release-${key.replace(/^checkout-/, '')}`))).exists;
  if (!entry || released || cents(-Number(entry.amount)) !== cents(amount)) throw new HttpError(409, 'Checkout credit needs review.');
  return entry;
}

/** Validate prepaid funding against immutable server-only checkout records. */
export async function verifyJobCredit(job: Record<string, any>) {
  if (!(Number(job.creditApplied) > 0)) return;
  await adminDb().runTransaction(async tx => {
    if ((await readWallet(tx, job.customerId)).paymentHold) throw new HttpError(409, 'Gift-card funding needs payment review.');
    const funding = job.orderId ? (await tx.get(adminDb().doc(`moverOrders/${job.orderId}`))).data() :
      (await tx.get(adminDb().doc(`checkoutTerms/${job.checkoutSessionId}`))).data();
    if (!funding || funding.customerId !== job.customerId || (job.orderId && funding.paymentStatus !== 'paid')) throw new HttpError(409, 'Move credit needs review.');
    const held = await checkoutCreditHeld(tx, job.customerId, job.creditLedgerKey, funding.creditApplied);
    const allocation = job.orderId ? funding.items?.find((item: Record<string, unknown>) => item.jobId === job.id) : null;
    if (job.orderId && !allocation) throw new HttpError(409, 'Move allocation is missing.');
    const credit = allocation ? allocation.creditCents / 100 : funding.creditApplied;
    const gift = allocation ? allocation.giftCents / 100 : funding.giftApplied;
    if (credit !== job.creditApplied || gift !== job.giftApplied || Number(held.giftApplied || 0) !== Number(funding.giftApplied || 0)) throw new HttpError(409, 'Move funding does not match.');
  });
}

/** Stop reuse of prepaid value when its original purchase is refunded or disputed. */
export async function holdGiftCardPurchase(paymentIntentId: string, reason: string) {
  const db=adminDb(),orders=await db.collection('giftCardOrders').where('paymentIntentId','==',paymentIntentId).get();
  for (const order of orders.docs) await db.runTransaction(async tx=>{
    const current=(await tx.get(order.ref)).data();
    if (!current?.code) return;
    const cardRef=db.doc(`giftCards/${current.code}`), card=(await tx.get(cardRef)).data();
    if (card?.redeemedBy) {
      // Include the read in the transaction so concurrent spending retries against this hold.
      const walletRef=wallet(card.redeemedBy); await tx.get(walletRef);
      tx.set(walletRef,{paymentHold:true,paymentHoldReason:reason,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    }
    tx.update(order.ref,{paymentHold:true,paymentHoldReason:reason});
    tx.update(cardRef,{paymentHold:true,status:card?.status==='active'?'held':card?.status||'held'});
  });
}
