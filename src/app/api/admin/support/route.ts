import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, requireRole } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    let query = db.collection('supportTickets').orderBy('createdAt', 'desc').limit(51);
    const cursor = new URL(req.url).searchParams.get('cursor');
    if (cursor) {
      if (!isId(cursor)) throw new HttpError(400, 'Invalid page.');
      const snapshot = await db.doc(`supportTickets/${cursor}`).get();
      if (!snapshot.exists) throw new HttpError(400, 'This page is no longer available.');
      query = query.startAfter(snapshot);
    }
    const snapshot = await query.get();
    const page = snapshot.docs.slice(0, 50);
    const tickets = page.map(doc => {
      const data = doc.data();
      return { id: doc.id, name: data.name, email: data.email, phone: data.phone,
        subject: data.subject, message: data.message, status: data.status,
        createdAt: data.createdAt?.toDate().toISOString() ?? null,
        firstResponseAt: data.firstResponseAt?.toDate?.().toISOString() ?? null, satisfaction: Number.isInteger(data.satisfaction) ? data.satisfaction : null };
    });
    return NextResponse.json({ tickets, nextCursor: snapshot.size > 50 ? page.at(-1)!.id : null },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
