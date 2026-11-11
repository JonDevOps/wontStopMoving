import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { cleanMoveDetails, CUSTOMER_FACING, diffMoveDetails, formatMoveDate } from '@/lib/move-details';

/**
 * Staff edit a booked move's details. Admins can edit any move; employees
 * only moves they're assigned to. Every change is logged in
 * jobs/{id}/changes (server-only), and the customer can be emailed.
 */
const iso = (v: any) => v?.toDate?.().toISOString() || null;

async function access(req: Request, params: Promise<{ id: string }>) {
  const { user, role } = await requireRole(req, ['admin', 'employee']);
  const { id } = await params;
  if (!isId(id)) throw new HttpError(404, 'Move not found.');
  const ref = adminDb().doc(`jobs/${id}`);
  const job = (await ref.get()).data();
  if (!job) throw new HttpError(404, 'Move not found.');
  if (role !== 'admin' && !(Array.isArray(job.employeeIds) && job.employeeIds.includes(user.uid))) throw new HttpError(403, 'Only admins and the crew assigned to this move can change it.');
  return { user, role, id, ref, job };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ref } = await access(req, params);
    const snap = await ref.collection('changes').orderBy('at', 'desc').limit(30).get();
    return NextResponse.json({ changes: snap.docs.map(d => ({ id: d.id, ...d.data(), at: iso(d.data().at) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, id, ref } = await access(req, params);
    const body = await readJson(req);
    const checked = cleanMoveDetails((body.details && typeof body.details === 'object' ? body.details : {}) as Record<string, unknown>);
    if (!checked.ok) throw new HttpError(400, checked.error);
    const db = adminDb();
    const editor = (await db.doc(`users/${user.uid}`).get()).data();
    const by = editor?.name || editor?.email || user.email || role;

    const result = await db.runTransaction(async tx => {
      const job = (await tx.get(ref)).data();
      if (!job) throw new HttpError(404, 'Move not found.');
      if (['completed', 'cancelled'].includes(job.status)) throw new HttpError(409, `This move is ${job.status}, so its details can’t be changed.`);
      const changes = diffMoveDetails(job, checked.data);
      if (!changes.length) return { changes, job };
      const patch: Record<string, any> = { detailsUpdatedAt: FieldValue.serverTimestamp(), detailsUpdatedBy: user.uid };
      for (const c of changes) {
        const v = checked.data[c.field];
        patch[c.field] = v === null || v === '' ? FieldValue.delete() : v;
      }
      tx.update(ref, patch);
      tx.set(ref.collection('changes').doc(), { changes, by, byUid: user.uid, role, reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '', at: FieldValue.serverTimestamp() });
      return { changes, job };
    });

    let emailed = false;
    const facing = result.changes.filter(c => CUSTOMER_FACING.includes(c.field));
    if (body.notifyCustomer === true && facing.length && result.job.customerId) {
      const customer = (await db.doc(`users/${result.job.customerId}`).get()).data();
      const to = customer?.email || (await adminAuth().getUser(result.job.customerId).catch(() => null))?.email;
      if (to) {
        const lines = facing.map(c => `${c.label}: ${c.field === 'moveDate' ? formatMoveDate(c.to) : c.to}`).join('\n');
        try {
          await enqueueEmail(`move-update:${id}:${Date.now()}`, {
            category: 'job', referenceId: id, to,
            subject: 'Your move details were updated',
            text: `Hi ${customer?.name || 'there'},\n\nWe updated the details of your upcoming move:\n\n${lines}\n\nSee everything in your dashboard:\nhttps://wontstopmoving.com/dashboard/customer/moves/${id}\n\nIf anything looks wrong, call us at (415) 214-5474 or reply to this email.\n\nWont Stop Moving`,
          });
          emailed = true;
        } catch (error) { console.error('Move update email failed', id, error); }
      }
    }
    return NextResponse.json({ changed: result.changes.length, changes: result.changes, emailed });
  } catch (error) { return errorResponse(error); }
}
