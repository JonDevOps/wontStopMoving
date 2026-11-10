import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { queueAccountApproval } from '@/lib/server/notifications';

/**
 * Changes a provider's, employee's or job application's status in one server
 * call, and sends the approval email when an account becomes approved.
 * The status change is saved first; a mail problem is reported back but
 * never undoes it (the email can be retried from Admin > Emails).
 */
const PROVIDER_STATUSES = ['pending', 'approved', 'suspended'];
const EMPLOYEE_STATUSES = ['applicant', 'training', 'active', 'rejected'];
const APPLICATION_STATUSES = ['new', 'active', 'rejected'];
const REGION = /^[A-Za-z .'-]{1,60}$/;

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { kind, id, status: rawStatus, region } = await readJson(req);
    const status = typeof rawStatus === 'string' ? rawStatus : '';
    if (!isId(id)) throw new HttpError(400, 'Choose a valid record.');
    const db = adminDb();
    const by = { statusUpdatedBy: user.uid, statusUpdatedAt: FieldValue.serverTimestamp() };
    let approve: { uid: string; role: 'provider' | 'employee' } | null = null;

    if (kind === 'provider') {
      if (!PROVIDER_STATUSES.includes(status)) throw new HttpError(400, 'Choose a provider status.');
      const ref = db.doc(`providers/${id}`);
      const before = await db.runTransaction(async tx => {
        const p = (await tx.get(ref)).data();
        if (!p) throw new HttpError(404, 'Provider not found.');
        tx.update(ref, { status, ...by });
        return p.status;
      });
      if (status === 'approved' && before !== 'approved') approve = { uid: id, role: 'provider' };
    } else if (kind === 'employee') {
      if (!EMPLOYEE_STATUSES.includes(status)) throw new HttpError(400, 'Choose an employee status.');
      if (region !== undefined && (typeof region !== 'string' || !REGION.test(region))) throw new HttpError(400, 'Choose a region.');
      const ref = db.doc(`employees/${id}`);
      const before = await db.runTransaction(async tx => {
        const e = (await tx.get(ref)).data();
        if (!e) throw new HttpError(404, 'Employee not found.');
        tx.update(ref, { status, ...(region !== undefined ? { region } : {}), ...by });
        return e.status;
      });
      if (status === 'active' && before !== 'active') approve = { uid: id, role: 'employee' };
    } else if (kind === 'application') {
      if (!APPLICATION_STATUSES.includes(status)) throw new HttpError(400, 'Choose an application status.');
      const appRef = db.doc(`applications/${id}`);
      const result = await db.runTransaction(async tx => {
        const a = (await tx.get(appRef)).data();
        if (!a?.userId || !isId(a.userId)) throw new HttpError(404, 'Candidate account link not found.');
        const empRef = db.doc(`employees/${a.userId}`);
        const e = (await tx.get(empRef)).data();
        if (!e) throw new HttpError(404, 'Candidate employee record not found.');
        tx.update(appRef, { status: status === 'active' ? 'approved' : status, ...by });
        tx.update(empRef, { status, ...by });
        return { uid: a.userId as string, before: e.status };
      });
      if (status === 'active' && result.before !== 'active') approve = { uid: result.uid, role: 'employee' };
    } else {
      throw new HttpError(400, 'Choose what to update.');
    }

    let email: 'sent' | 'queued' | 'failed' | 'none' = 'none';
    if (approve) {
      try {
        const queued = await queueAccountApproval(approve.uid, approve.role);
        email = !queued ? 'failed' : queued.status === 'sent' ? 'sent' : queued.status === 'needs_review' ? 'failed' : 'queued';
      } catch (error) { console.error('Approval email failed', approve, error); email = 'failed'; }
    }
    return NextResponse.json({ status, email });
  } catch (error) { return errorResponse(error); }
}
