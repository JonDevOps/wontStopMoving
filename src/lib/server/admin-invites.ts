import { FieldValue } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminDb } from './firebase-admin';

/**
 * Admin invites. An admin adds an email at `adminInvites/{email}`; the first
 * time someone signs in with that email *verified* by Firebase (Google
 * sign-in always is), their profile becomes admin. Browsers can't read or
 * write invites (no Firestore rule allows it); only these server routes can.
 */
export const normalizeEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
export const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(v) && v.length <= 254;

/** Turns a pending invite into admin access. Returns true if this user is now admin because of it. */
export async function claimAdminInvite(token: DecodedIdToken): Promise<boolean> {
  const email = normalizeEmail(token.email);
  if (!email || token.email_verified !== true) return false;
  const db = adminDb();
  const inviteRef = db.doc(`adminInvites/${email}`), userRef = db.doc(`users/${token.uid}`);
  return db.runTransaction(async tx => {
    const [invite, profile] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);
    if (!invite.exists || invite.data()?.status !== 'pending') return false;
    const p = profile.data();
    tx.set(userRef, {
      id: token.uid, email, name: p?.name || token.name || email.split('@')[0], role: 'admin',
      ...(profile.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      adminGrantedAt: FieldValue.serverTimestamp(), adminGrantedBy: invite.data()?.invitedByEmail || 'admin', previousRole: p?.role || null,
    }, { merge: true });
    tx.update(inviteRef, { status: 'claimed', claimedBy: token.uid, claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
