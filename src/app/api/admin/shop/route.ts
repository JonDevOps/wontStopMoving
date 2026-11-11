import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { orderView } from '@/lib/server/shop';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/shop';

/** Supplies orders for the team: list, and update status (the customer is emailed on ready / out for delivery). */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const snap = await adminDb().collection('shopOrders').orderBy('createdAt', 'desc').limit(300).get();
    return NextResponse.json({ orders: snap.docs.map(d => orderView(d.id, d.data())), statuses: ORDER_STATUSES }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    if (!isId(body.id)) throw new HttpError(400, 'Choose an order.');
    const status = (Object.keys(ORDER_STATUSES) as OrderStatus[]).find(s => s === body.status);
    const ref = adminDb().doc(`shopOrders/${body.id}`), o = (await ref.get()).data();
    if (!o) throw new HttpError(404, 'Order not found.');
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid };
    if (status) { if (o.status === 'pending' && status !== 'cancelled') throw new HttpError(409, 'This order hasn’t been paid.'); patch.status = status; }
    if (typeof body.adminNote === 'string') patch.adminNote = body.adminNote.trim().slice(0, 1000);
    await ref.update(patch);
    if (status && status !== o.status && (status === 'ready' || status === 'out-for-delivery') && o.email) {
      try {
        await enqueueEmail(`shop-status:${body.id}:${status}`, { category: 'shop', referenceId: body.id, to: o.email, subject: status === 'ready' ? 'Your moving supplies are ready for pickup' : 'Your moving supplies are on the way', text: `${status === 'ready' ? 'Your order is ready to pick up at 855 Maude Ave, Mountain View.' : 'Your order is out for delivery today.'}\n\nOrder details: https://wontstopmoving.com/shop/order/${body.id}\n\nQuestions? Call (415) 214-5474.\n\nWont Stop Moving` });
      } catch (error) { console.error('Shop status email failed', body.id, error); }
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
