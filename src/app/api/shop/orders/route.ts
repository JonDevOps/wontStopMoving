import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, requireRole } from '@/lib/server/auth';
import { orderView } from '@/lib/server/shop';

/** The signed-in customer's supplies orders, newest first, and their upcoming moves (for "bring it with my move"). */
export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const db = adminDb();
    const [orders, jobs] = await Promise.all([
      db.collection('shopOrders').where('customerId', '==', user.uid).limit(50).get(),
      db.collection('jobs').where('customerId', '==', user.uid).limit(50).get(),
    ]);
    return NextResponse.json({
      orders: orders.docs.map(d => orderView(d.id, d.data())).filter(o => o.status !== 'pending' || o.createdAt).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
      moves: jobs.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(j => !['completed', 'cancelled'].includes(j.status)).map(j => ({ id: j.id, moveDate: j.moveDate || '', pickupAddress: j.pickupAddress || '' })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
