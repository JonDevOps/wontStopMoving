import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { queueAccountApproval, queueJobEmails, queueQuoteEmail, deliverEmail, mailConfigured } from '@/lib/server/notifications';

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const iso = (value: any) => value?.toDate?.().toISOString() || null;
    const outbox = await adminDb().collection('emailOutbox').orderBy('createdAt', 'desc').limit(100).get();
    return NextResponse.json({ configured: mailConfigured(), messages: outbox.docs.map(doc => { const d = doc.data(); return { id: doc.id, to: d.to, subject: d.subject, category: d.category || null, referenceId: d.referenceId || null, status: d.status, failureCode: d.failureCode || null, createdAt: iso(d.createdAt), attemptedAt: iso(d.attemptedAt), sentAt: iso(d.sentAt) }; }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

// A message stuck in "sending" this long was interrupted (e.g. the server
// stopped mid-send), so an admin may retry it.
const STUCK_SENDING_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { kind, id } = await readJson(req);
    if (!isId(id)) throw new HttpError(400, 'Choose a valid record.');
    if (kind === 'pending') {
      const status = await deliverEmail(id);
      return NextResponse.json({ status });
    }
    if (kind === 'retry' || kind === 'dismiss') {
      // An admin has checked a failed or unsent message. Retrying puts it back
      // in the queue and sends it once; dismissing keeps the record but stops it.
      const db = adminDb(), ref = db.doc(`emailOutbox/${id}`);
      await db.runTransaction(async tx => {
        const d = (await tx.get(ref)).data();
        if (!d) throw new HttpError(404, 'That email no longer exists.');
        const stuck = d.status === 'sending' && (d.attemptedAt?.toMillis?.() || 0) < Date.now() - STUCK_SENDING_MS;
        if (!['needs_review', 'pending', 'dismissed'].includes(d.status) && !stuck) throw new HttpError(409, d.status === 'sent' ? 'That email was already sent.' : 'That email is being sent right now.');
        tx.update(ref, kind === 'retry'
          ? { status: 'pending', failureCode: FieldValue.delete(), retriedBy: user.uid, retriedAt: FieldValue.serverTimestamp() }
          : { status: 'dismissed', dismissedBy: user.uid, dismissedAt: FieldValue.serverTimestamp() });
      });
      return NextResponse.json({ status: kind === 'retry' ? await deliverEmail(id) : 'dismissed' });
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
