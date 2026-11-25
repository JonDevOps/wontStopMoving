import { Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/lib/stripe';
import { adminDb } from './firebase-admin';

/**
 * The Stripe customer used to save a booking card for extra hours the customer
 * approves later (#153). The id lives server-only in stripeCustomers/{uid}, not
 * on the user's profile.
 */
export async function savedCardCustomer(uid: string, email: string | undefined) {
  const ref = adminDb().doc(`stripeCustomers/${uid}`);
  const existing = (await ref.get()).data()?.id as string | undefined;
  if (existing) return existing;
  const id = (await stripe.customers.create({ email, metadata: { uid } }, { idempotencyKey: `customer-${uid}` })).id;
  await ref.set({ id, createdAt: Timestamp.now() });
  return id;
}

export const SAVED_CARD_NOTE = 'Your card is saved securely so you can approve extra hours from the app if your crew needs more time. It is only charged when you tap Accept.';
