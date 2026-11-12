import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';

/**
 * Product feedback from anyone signed in (customers, providers, agents,
 * employees, admins), reviewed by admins and employees. appFeedback/{id},
 * server-only. Replies are emailed to the sender.
 */
const TYPES = ['idea', 'problem', 'praise', 'other'] as const;
const STATUSES = ['new', 'reviewing', 'planned', 'done', 'wont-do'] as const;
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin', 'employee']);
    const snap = await adminDb().collection('appFeedback').orderBy('createdAt', 'desc').limit(500).get();
    return NextResponse.json({ items: snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: iso(d.data().createdAt), repliedAt: iso(d.data().repliedAt), updatedAt: iso(d.data().updatedAt) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const db = adminDb();
    if (body.action === 'update') {
      const { user } = await requireRole(req, ['admin', 'employee']);
      if (!isId(body.id)) throw new HttpError(400, 'Choose feedback.');
      const ref = db.doc(`appFeedback/${body.id}`), item = (await ref.get()).data();
      if (!item) throw new HttpError(404, 'Feedback not found.');
      const me = (await db.doc(`users/${user.uid}`).get()).data();
      const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid };
      const status = STATUSES.find(s => s === body.status);
      if (status) patch.status = status;
      const reply = str(body.reply, 3000);
      if (reply) Object.assign(patch, { reply, repliedBy: me?.name || user.email || 'Wont Stop Moving', repliedAt: FieldValue.serverTimestamp() });
      await ref.update(patch);
      if (reply && item.email) {
        try { await enqueueEmail(`feedback-reply:${body.id}:${Date.now()}`, { category: 'feedback', referenceId: String(body.id), to: item.email, subject: 'Thanks for your feedback', text: `Hi ${item.name || 'there'},\n\nThanks for your feedback:\n"${String(item.message).slice(0, 500)}"\n\n${reply}\n\n${me?.name || 'The Wont Stop Moving team'}\nWont Stop Moving` }); }
        catch (error) { console.error('Feedback reply email failed', body.id, error); }
      }
      return NextResponse.json({ ok: true });
    }
    const { user, role } = await requireRole(req, ['customer', 'provider', 'agent', 'employee', 'admin']);
    const type = TYPES.find(t => t === body.type) || 'other';
    const message = str(body.message, 4000);
    if (message.length < 5) throw new HttpError(400, 'Tell us a bit more.');
    // Single-field query (no composite index needed); count the last hour in memory.
    const mine = await db.collection('appFeedback').where('byUid', '==', user.uid).select('createdAt').limit(200).get();
    if (mine.docs.filter(d => (d.data().createdAt?.toMillis?.() || 0) > Date.now() - 3600_000).length >= 10) throw new HttpError(429, 'Thanks! That’s a lot of feedback this hour. Try again later.');
    const profile = (await db.doc(`users/${user.uid}`).get()).data();
    const ref = await db.collection('appFeedback').add({
      byUid: user.uid, role, name: profile?.name || '', email: profile?.email || user.email || '', type, message, page: str(body.page, 200),
      status: 'new', createdAt: FieldValue.serverTimestamp(),
    });
    try { await enqueueEmail(`feedback:${ref.id}`, { category: 'feedback', referenceId: ref.id, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org', subject: `New ${type} from a ${role}: ${message.slice(0, 60)}`, text: `${profile?.name || user.email} (${role}) sent ${type}${body.page ? ` from ${str(body.page, 200)}` : ''}:\n\n${message}\n\nReview: https://wontstopmoving.com/dashboard/admin/feedback\n\nWont Stop Moving` }); }
    catch (error) { console.error('Feedback alert failed', ref.id, error); }
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
