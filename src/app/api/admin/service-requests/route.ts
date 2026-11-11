import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { newFeedbackToken, sendResolutionEmail } from '@/lib/server/service-desk';
import { RESPONSE_TARGET_HOURS, SERVICE_REQUEST_LABELS, type ServiceRequestType } from '@/lib/service-requests';

/** Service desk: reschedule and cancellation requests and damage claims. */
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [requests, tickets] = await Promise.all([
      db.collection('serviceRequests').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('supportTickets').orderBy('createdAt', 'desc').limit(200).get(),
    ]);
    const now = Date.now();
    const rows = requests.docs.map(d => {
      const r = d.data();
      const created = r.createdAt?.toMillis?.() ?? null, responded = r.firstResponseAt?.toMillis?.() ?? null;
      return {
        id: d.id, type: r.type as ServiceRequestType, status: r.status, jobId: r.jobId, customerName: r.customerName, customerEmail: r.customerEmail, customerPhone: r.customerPhone,
        moveDate: r.moveDate, reason: r.reason, requestedDate: r.requestedDate || null, item: r.item || null, estimatedValue: r.estimatedValue ?? null, photoPaths: Array.isArray(r.photoPaths) ? r.photoPaths : [],
        adminMessage: r.adminMessage || null, satisfaction: r.satisfaction ?? null, createdAt: iso(r.createdAt), resolvedAt: iso(r.resolvedAt),
        overdue: r.status === 'open' && !responded && !!created && now - created > RESPONSE_TARGET_HOURS[r.type as ServiceRequestType] * 3600000,
      };
    });
    // Satisfaction across resolved requests and support tickets (1–5; 4–5 counts as satisfied).
    const scores = [...requests.docs, ...tickets.docs].map(d => d.data().satisfaction).filter((s): s is number => Number.isInteger(s));
    const metrics = {
      open: rows.filter(r => r.status !== 'resolved').length,
      overdue: rows.filter(r => r.overdue).length,
      claimsOpen: rows.filter(r => r.type === 'claim' && r.status !== 'resolved').length,
      satisfactionPercent: scores.length ? Math.round((scores.filter(s => s >= 4).length / scores.length) * 100) : null,
      satisfactionCount: scores.length,
    };
    return NextResponse.json({ requests: rows, metrics }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { id, action, message } = await readJson(req);
    if (!isId(id)) throw new HttpError(400, 'Choose a request.');
    const note = typeof message === 'string' ? message.trim().slice(0, 3000) : '';
    const db = adminDb(), ref = db.doc(`serviceRequests/${id}`);
    const result = await db.runTransaction(async tx => {
      const r = (await tx.get(ref)).data();
      if (!r) throw new HttpError(404, 'Request not found.');
      if (r.status === 'resolved') throw new HttpError(409, 'This request is already resolved.');
      const firstResponse = r.firstResponseAt ? {} : { firstResponseAt: FieldValue.serverTimestamp() };
      if (action === 'in-progress') { tx.update(ref, { status: 'in-progress', ...firstResponse, updatedBy: user.uid }); return null; }
      if (action !== 'resolve') throw new HttpError(400, 'Choose an action.');
      if (note.length < 5) throw new HttpError(400, 'Write a short message to the customer explaining the outcome.');
      const token = newFeedbackToken();
      tx.update(ref, { status: 'resolved', ...firstResponse, resolvedAt: FieldValue.serverTimestamp(), resolvedBy: user.uid, adminMessage: note, feedbackToken: token });
      return { token, r };
    });
    if (result?.r.customerEmail) {
      await sendResolutionEmail({ kind: 'request', id, token: result.token, to: result.r.customerEmail, name: String(result.r.customerName || '').split(' ')[0], subject: SERVICE_REQUEST_LABELS[result.r.type as ServiceRequestType], message: note });
    }
    return NextResponse.json({ status: action === 'resolve' ? 'resolved' : 'in-progress' });
  } catch (error) { return errorResponse(error); }
}
