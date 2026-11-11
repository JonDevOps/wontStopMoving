import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { isEmail, normalizeEmail } from '@/lib/server/admin-invites';

const iso = (v: any) => v?.toDate?.().toISOString() || null;

/** Admins and pending admin invites. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [admins, invites] = await Promise.all([
      db.collection('users').where('role', '==', 'admin').limit(200).get(),
      db.collection('adminInvites').where('status', '==', 'pending').limit(200).get(),
    ]);
    return NextResponse.json({
      admins: admins.docs.map(d => ({ uid: d.id, name: d.data().name || '', email: d.data().email || '', grantedBy: d.data().adminGrantedBy || null, grantedAt: iso(d.data().adminGrantedAt) })),
      invites: invites.docs.map(d => ({ email: d.id, invitedBy: d.data().invitedByEmail || '', invitedAt: iso(d.data().createdAt) })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/**
 * { action: 'invite', email } adds an admin: right away if that email already
 * has an account with a verified email, otherwise when they first sign in
 * with it verified (so nobody can pre-register someone else's address).
 * { action: 'cancel', email } withdraws a pending invite.
 * { action: 'remove', uid } takes admin access away (back to a customer account).
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb();
    const me = (await db.doc(`users/${user.uid}`).get()).data();
    const by = me?.email || user.email || 'admin';

    if (body.action === 'invite') {
      const email = normalizeEmail(body.email);
      if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
      const found = await adminAuth().getUserByEmail(email).catch((error: { code?: string }) => { if (error?.code === 'auth/user-not-found') return null; throw error; });
      const existing = found?.emailVerified ? found : null;
      if (existing) {
        const ref = db.doc(`users/${existing.uid}`), p = (await ref.get()).data();
        if (p?.role === 'admin') throw new HttpError(409, 'That person is already an admin.');
        await ref.set({ id: existing.uid, email, name: p?.name || existing.displayName || email.split('@')[0], role: 'admin', ...(p ? {} : { createdAt: FieldValue.serverTimestamp() }), adminGrantedAt: FieldValue.serverTimestamp(), adminGrantedBy: by, previousRole: p?.role || null }, { merge: true });
      } else {
        await db.doc(`adminInvites/${email}`).set({ email, status: 'pending', invitedBy: user.uid, invitedByEmail: by, createdAt: FieldValue.serverTimestamp() });
      }
      try {
        await enqueueEmail(`admin-invite:${email}:${Date.now()}`, {
          category: 'account', referenceId: email, to: email,
          subject: 'You have admin access to Wont Stop Moving',
          text: `Hi,\n\n${by} gave you admin access to the Wont Stop Moving dashboard.\n\n${existing ? 'Sign in as usual' : `Sign in with Google using this email address (${email}), or verify this email on your existing account first`} and choose Admin:\nhttps://wontstopmoving.com/login?role=admin\n\nWont Stop Moving`,
        });
      } catch (error) { console.error('Admin invite email failed', error); }
      return NextResponse.json({ status: existing ? 'granted' : 'invited' });
    }

    if (body.action === 'cancel') {
      const email = normalizeEmail(body.email);
      await db.doc(`adminInvites/${email}`).set({ status: 'cancelled', cancelledBy: user.uid, cancelledAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ status: 'cancelled' });
    }

    if (body.action === 'remove') {
      if (!isId(body.uid)) throw new HttpError(400, 'Choose an admin.');
      if (body.uid === user.uid) throw new HttpError(400, 'You can’t remove your own admin access.');
      const ref = db.doc(`users/${body.uid}`), p = (await ref.get()).data();
      if (p?.role !== 'admin') throw new HttpError(404, 'That person is not an admin.');
      const admins = await db.collection('users').where('role', '==', 'admin').limit(3).get();
      if (admins.size < 2) throw new HttpError(409, 'There must always be at least one admin.');
      await ref.update({ role: 'customer', adminRemovedAt: FieldValue.serverTimestamp(), adminRemovedBy: by });
      return NextResponse.json({ status: 'removed' });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
