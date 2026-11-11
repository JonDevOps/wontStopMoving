import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, requireRole } from '@/lib/server/auth';

/**
 * Adds every custom quote sent to this customer's verified email to their
 * account, so it shows in My Quotes without opening the emailed link first.
 * Quotes already claimed by another account are never touched.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer']);
    if (!user.email_verified || !user.email) return NextResponse.json({ claimed: 0, verified: false });
    const db = adminDb();
    const snap = await db.collection('quotes').where('email', '==', user.email.toLowerCase()).where('isCustomQuote', '==', true).where('customerId', '==', '').limit(50).get();
    let claimed = 0;
    for (const d of snap.docs) {
      const ok = await db.runTransaction(async tx => {
        const fresh = (await tx.get(d.ref)).data();
        if (!fresh || fresh.customerId) return false;
        tx.update(d.ref, { customerId: user.uid, claimedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (ok) claimed++;
    }
    return NextResponse.json({ claimed, verified: true });
  } catch (error) { return errorResponse(error); }
}
