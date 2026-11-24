import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

/**
 * Suspends or reinstates a user account (#109).
 * Suspending disables Firebase Auth sign-in, revokes existing sessions and
 * records who made the change on the user's Firestore profile.
 */
export async function POST(req: Request) {
  try {
    const { user: admin } = await requireRole(req, ['admin']);
    const { uid, suspended } = await readJson(req);
    if (!isId(uid)) throw new HttpError(400, 'Choose an account.');
    if (typeof suspended !== 'boolean') throw new HttpError(400, 'Say whether to suspend or reinstate.');
    if (uid === admin.uid) throw new HttpError(400, 'You cannot suspend your own account.');

    await adminAuth().updateUser(uid, { disabled: suspended });
    if (suspended) await adminAuth().revokeRefreshTokens(uid);
    await adminDb().collection('users').doc(uid).set({
      suspended,
      suspendedUpdatedBy: admin.uid,
      suspendedUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ uid, suspended }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
