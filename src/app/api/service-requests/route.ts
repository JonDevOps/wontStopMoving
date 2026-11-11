import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { SERVICE_REQUEST_LABELS, type ServiceRequestType } from '@/lib/service-requests';

/**
 * A customer asks to reschedule or cancel a move, or reports damage or a
 * missing item (with photos uploaded to Storage under claims/{uid}/{jobId}/).
 * Requests go to the admin service desk; nothing about the booking or
 * payment changes until the team acts on it.
 */
const TYPES: ServiceRequestType[] = ['reschedule', 'cancel', 'claim'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!isId(jobId)) throw new HttpError(400, 'Choose a move.');
    const snap = await adminDb().collection('serviceRequests').where('customerId', '==', user.uid).where('jobId', '==', jobId).limit(50).get();
    const requests = snap.docs.map(d => { const r = d.data(); return { id: d.id, type: r.type, status: r.status, reason: r.reason, requestedDate: r.requestedDate || null, adminMessage: r.adminMessage || null, createdAt: iso(r.createdAt), resolvedAt: iso(r.resolvedAt) }; })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const body = await readJson(req);
    if (!isId(body.jobId)) throw new HttpError(400, 'Choose a move.');
    if (!TYPES.includes(body.type as ServiceRequestType)) throw new HttpError(400, 'Choose what you need help with.');
    const type = body.type as ServiceRequestType;
    const reason = str(body.reason, 3000);
    if (reason.length < 5) throw new HttpError(400, 'Tell us a little more so we can help.');
    const db = adminDb();
    const job = (await db.doc(`jobs/${body.jobId}`).get()).data();
    if (!job || job.customerId !== user.uid) throw new HttpError(404, 'Move not found.');
    if (job.status === 'cancelled') throw new HttpError(409, 'This move is already cancelled.');
    if (type !== 'claim' && job.status === 'completed') throw new HttpError(409, 'This move is already complete.');
    if (type === 'claim' && job.status !== 'completed' && job.status !== 'in-progress') throw new HttpError(409, 'You can report damage once your move has started.');

    let requestedDate: string | null = null;
    if (type === 'reschedule') {
      requestedDate = str(body.requestedDate, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || Number.isNaN(Date.parse(requestedDate)) || Date.parse(requestedDate) < Date.now() - 86400000) throw new HttpError(400, 'Choose a new date in the future.');
    }
    const prefix = `claims/${user.uid}/${body.jobId}/`;
    const photoPaths = type === 'claim' && Array.isArray(body.photoPaths)
      ? body.photoPaths.filter((p: unknown): p is string => typeof p === 'string' && p.startsWith(prefix) && p.length < 300 && !p.includes('..')).slice(0, 6) : [];
    const value = type === 'claim' && typeof body.estimatedValue === 'number' && Number.isFinite(body.estimatedValue) && body.estimatedValue >= 0 ? Math.min(Math.round(body.estimatedValue * 100) / 100, 1_000_000) : null;

    const open = await db.collection('serviceRequests').where('customerId', '==', user.uid).where('jobId', '==', body.jobId).where('status', 'in', ['open', 'in-progress']).get();
    if (open.docs.some(d => d.data().type === type)) throw new HttpError(409, 'You already have an open request like this. We’ll be in touch soon.');

    const profile = (await db.doc(`users/${user.uid}`).get()).data();
    const ref = await db.collection('serviceRequests').add({
      type, jobId: body.jobId, customerId: user.uid, customerName: profile?.name || '', customerEmail: profile?.email || user.email || '', customerPhone: profile?.phone || '',
      moveDate: job.moveDate || '', reason, requestedDate, item: type === 'claim' ? str(body.item, 200) : null, estimatedValue: value, photoPaths,
      status: 'open', createdAt: FieldValue.serverTimestamp(),
    });
    try {
      await enqueueEmail(`service-request:${ref.id}`, {
        category: 'service', referenceId: ref.id, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
        subject: `${SERVICE_REQUEST_LABELS[type]}: ${profile?.name || 'customer'}, move ${job.moveDate || ''}`,
        text: `${SERVICE_REQUEST_LABELS[type]}\n\nCustomer: ${profile?.name || '—'} · ${profile?.phone || ''} · ${profile?.email || user.email || ''}\nMove date: ${job.moveDate || '—'}${requestedDate ? `\nRequested new date: ${requestedDate}` : ''}${photoPaths.length ? `\nPhotos: ${photoPaths.length}` : ''}\n\n${reason}\n\nOpen the service desk:\nhttps://wontstopmoving.com/dashboard/admin/service\n\nWont Stop Moving`,
      });
    } catch (error) { console.error('Service request alert failed', ref.id, error); }
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
