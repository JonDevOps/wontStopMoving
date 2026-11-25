import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

/**
 * Admin changes to a standard quote, each recorded in quotes/{id}.adjustments
 * with who made it and when (#127):
 *  - { action: 'price', total: number | null, reason } sets or clears the admin price
 *  - { action: 'status', status: 'new' | 'processed' | 'expired' }
 */
const STATUSES = ['new', 'processed', 'expired'] as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { id } = await ctx.params;
    if (!isId(id)) throw new HttpError(400, 'Choose a quote.');
    const { action, total, reason, status } = await readJson(req);
    const db = adminDb(), ref = db.doc(`quotes/${id}`);
    const q = (await ref.get()).data();
    if (!q) throw new HttpError(404, 'Quote not found.');
    const byName = ((await db.doc(`users/${user.uid}`).get()).data()?.name as string) || user.email || 'Admin';
    const entry = { by: user.uid, byName, at: Date.now() };

    if (action === 'price') {
      if (q.isCustomQuote) throw new HttpError(409, 'Custom quotes are priced when they are created.');
      if (q.paymentStatus === 'paid') throw new HttpError(409, 'This quote is already paid.');
      const next = total === null ? null : Number(total);
      if (next !== null && (!Number.isFinite(next) || next < 1 || next > 999999)) throw new HttpError(400, 'Enter a price between $1 and $999,999.');
      const note = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
      if (next !== null && !note) throw new HttpError(400, 'Add a short reason for the price change.');
      const from = typeof q.adjustedTotal === 'number' ? q.adjustedTotal : null;
      await ref.update({
        adjustedTotal: next === null ? FieldValue.delete() : Math.round(next * 100) / 100,
        adjustedBy: user.uid, adjustedAt: FieldValue.serverTimestamp(),
        adjustments: FieldValue.arrayUnion({ ...entry, type: 'price', from, to: next === null ? null : Math.round(next * 100) / 100, reason: note || 'Reset to calculated price' }),
      });
    } else if (action === 'status') {
      if (!STATUSES.includes(status as typeof STATUSES[number])) throw new HttpError(400, 'Choose a status.');
      await ref.update({
        status,
        adjustments: FieldValue.arrayUnion({ ...entry, type: 'status', from: q.status || 'new', to: status }),
      });
    } else {
      throw new HttpError(400, 'Choose an action.');
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
