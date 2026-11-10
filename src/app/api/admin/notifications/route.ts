import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { queueAccountApproval, queueJobEmails, queueQuoteEmail, deliverEmail, mailConfigured } from '@/lib/server/notifications';

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const outbox = await adminDb().collection('emailOutbox').orderBy('createdAt', 'desc').limit(50).get();
    return NextResponse.json({ configured: mailConfigured(), messages: outbox.docs.map(doc => { const d = doc.data(); return { id: doc.id, to: d.to, subject: d.subject, status: d.status, createdAt: d.createdAt?.toDate().toISOString() || null }; }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const { kind, id } = await readJson(req);
    if (!isId(id)) throw new HttpError(400, 'Choose a valid record.');
    if (kind === 'pending') {
      const status = await deliverEmail(id);
      return NextResponse.json({ status });
    }
    if (kind === 'job') { await queueJobEmails(id); return NextResponse.json({ queued: true }); }
    if (kind === 'quote') {
      const q = (await adminDb().doc(`quotes/${id}`).get()).data();
      if (!q?.isCustomQuote || q.status !== 'new' || q.expiresAt.toMillis() <= Date.now()) throw new HttpError(409, 'Choose an available custom quote.');
      return NextResponse.json(await queueQuoteEmail(id));
    }
    if (kind === 'provider' || kind === 'employee') {
      const p = (await adminDb().doc(`${kind === 'provider' ? 'providers' : 'employees'}/${id}`).get()).data();
      if (!p || !['approved', 'active'].includes(p.status)) throw new HttpError(409, 'Approve the account first.');
      return NextResponse.json(await queueAccountApproval(id, kind));
    }
    throw new HttpError(400, 'Choose a notification type.');
  } catch (error) { return errorResponse(error); }
}
