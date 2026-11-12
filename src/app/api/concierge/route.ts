import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { CONCIERGE_SERVICES, isConciergeService } from '@/lib/concierge';

const iso = (v: any) => v?.toDate?.().toISOString() || null;

/** A customer's concierge requests for one move. */
export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!isId(jobId)) throw new HttpError(400, 'Choose a move.');
    const snap = await adminDb().collection('conciergeRequests').where('customerId', '==', user.uid).where('jobId', '==', jobId).limit(50).get();
    return NextResponse.json({
      requests: snap.docs.map(d => { const r = d.data(); return { id: d.id, service: r.service, status: r.status, partnerName: r.partnerName || null, createdAt: iso(r.createdAt) }; }),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Ask for a partner service on a move. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const body = await readJson(req);
    if (!isId(body.jobId)) throw new HttpError(400, 'Choose a move.');
    if (!isConciergeService(body.service)) throw new HttpError(400, 'Choose a service.');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const db = adminDb();
    const job = (await db.doc(`jobs/${body.jobId}`).get()).data();
    if (!job || job.customerId !== user.uid) throw new HttpError(404, 'Move not found.');
    if (job.status === 'cancelled') throw new HttpError(409, 'This move is cancelled.');
    const dupes = await db.collection('conciergeRequests').where('customerId', '==', user.uid).where('jobId', '==', body.jobId).get();
    if (dupes.docs.some(d => d.data().service === body.service && d.data().status !== 'closed')) throw new HttpError(409, 'You already asked for this. We’ll be in touch soon.');
    const profile = (await db.doc(`users/${user.uid}`).get()).data();
    const label = CONCIERGE_SERVICES[body.service as keyof typeof CONCIERGE_SERVICES].label;
    const ref = await db.collection('conciergeRequests').add({
      customerId: user.uid, jobId: body.jobId, service: body.service, note, status: 'new',
      customerName: profile?.name || '', customerEmail: profile?.email || user.email || '', customerPhone: profile?.phone || '',
      moveDate: job.moveDate || '', pickupAddress: job.pickupAddress || '', dropoffAddress: job.dropoffAddress || '', state: job.state || '',
      createdAt: FieldValue.serverTimestamp(),
    });
    await enqueueEmail(`concierge:${ref.id}`, {
      category: 'concierge', referenceId: ref.id, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
      subject: `Concierge request: ${label} (${job.moveDate || 'date TBD'})`,
      text: `${profile?.name || 'A customer'} asked for ${label} with their move.\n\nMove date: ${job.moveDate || 'TBD'}\nFrom: ${job.pickupAddress || '?'}\nTo: ${job.dropoffAddress || '?'}\n${note ? `Note: ${note}\n` : ''}\nIntroduce a partner:\nhttps://wontstopmoving.com/dashboard/admin/concierge\n\nWont Stop Moving`,
    }).catch(error => console.error('Concierge email failed', ref.id, error));
    return NextResponse.json({ id: ref.id });
  } catch (error) { return errorResponse(error); }
}
