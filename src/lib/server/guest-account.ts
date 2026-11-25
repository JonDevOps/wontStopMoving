import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './firebase-admin';
import { HttpError } from './auth';
import { enqueueEmail } from './notifications';

/**
 * Guest checkout (#151): book and pay without signing in. The customer account
 * is created from the checkout details; after payment we email a link to set a
 * password. An email that already belongs to a real account must sign in.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function guestCustomer(input: { name: unknown; email: unknown; phone: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 120) : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase().slice(0, 254) : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim().slice(0, 40) : '';
  if (name.length < 2) throw new HttpError(400, 'Enter your name.');
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (phone.replace(/\D/g, '').length < 10) throw new HttpError(400, 'Enter a phone number your crew can reach you at.');

  const auth = adminAuth(), db = adminDb();
  const existing = await auth.getUserByEmail(email).catch(() => null);
  if (existing) {
    const profile = (await db.doc(`users/${existing.uid}`).get()).data();
    // A previous guest checkout that never set a password can be reused; anything else must sign in.
    const stillGuest = profile?.guestCheckout === true && profile?.role === 'customer' && existing.providerData.length === 0;
    if (!stillGuest) throw new HttpError(409, 'An account already uses this email. Sign in to finish booking.');
    return { uid: existing.uid, email };
  }
  let uid: string;
  try {
    uid = (await auth.createUser({ email, displayName: name, emailVerified: false })).uid;
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-exists') throw new HttpError(409, 'An account already uses this email. Sign in to finish booking.');
    throw e;
  }
  await db.doc(`users/${uid}`).set({ role: 'customer', name, email, phone, guestCheckout: true, createdAt: FieldValue.serverTimestamp() });
  return { uid, email };
}

/** After a guest's first payment, email a link to set their password (once). */
export async function sendGuestPasswordEmail(uid: string, origin = 'https://wontstopmoving.com') {
  const db = adminDb(), ref = db.doc(`users/${uid}`);
  const profile = (await ref.get()).data();
  if (!profile?.guestCheckout || profile.setPasswordEmailedAt || typeof profile.email !== 'string') return;
  const link = await adminAuth().generatePasswordResetLink(profile.email, { url: `${origin}/login?role=customer` });
  await enqueueEmail(`guest-password:${uid}`, {
    to: profile.email, category: 'account', referenceId: uid,
    subject: 'Your Wont Stop Moving booking: set your password',
    text: `Hi ${profile.name || 'there'},\n\nYour move is booked and paid. We created a Wont Stop Moving account for you so you can see your booking, your crew and your payment release code.\n\nSet your password here:\n${link}\n\nYour release code is also in a separate email. Give it to your crew only after the work is done to your satisfaction.`,
  });
  await ref.update({ setPasswordEmailedAt: FieldValue.serverTimestamp() });
}
