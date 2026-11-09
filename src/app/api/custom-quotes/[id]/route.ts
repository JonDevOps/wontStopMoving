import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, requireRole } from '@/lib/server/auth';

// Opening the private link binds it only to its intended verified recipient.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const { id } = await params;
    if (!isId(id)) throw new HttpError(404, 'Quote not found.');
    if (!user.email_verified || !user.email) throw new HttpError(403, 'Verify your email address before opening this quote.');
    const db = adminDb();
    const result = await db.runTransaction(async tx => {
      const ref = db.doc(`quotes/${id}`);
      const snap = await tx.get(ref);
      const q = snap.data();
      if (!q?.isCustomQuote || q.email !== user.email!.toLowerCase() || (q.customerId && q.customerId !== user.uid)) throw new HttpError(404, 'Quote not found for this account. Sign in using the email it was sent to.');
      if (!q.customerId) tx.update(ref, { customerId: user.uid, openedAt: FieldValue.serverTimestamp() });
      return { id, name: q.name, description: q.description, pickupAddress: q.pickupAddress, dropoffAddress: q.dropoffAddress, moveDate: q.moveDate, pricing: q.pricing, status: q.status, expiresAt: q.expiresAt.toDate().toISOString() };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
