import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

/**
 * Shared admin notes board (#133), in adminNotes/{id} (server-only).
 * Any admin can read, post, pin and resolve; only the author can delete.
 */
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const snap = await adminDb().collection('adminNotes').orderBy('createdAt', 'desc').limit(200).get();
    const notes = snap.docs.map(d => {
      const n = d.data();
      return { id: d.id, text: n.text || '', authorId: n.authorId || '', authorName: n.authorName || 'Admin', pinned: n.pinned === true, resolved: n.resolved === true, topic: n.topic || '', createdAt: iso(n.createdAt), updatedAt: iso(n.updatedAt), updatedByName: n.updatedByName || null };
    });
    return NextResponse.json({ notes }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { action, id, text, topic, value } = await readJson(req);
    const db = adminDb();
    const name = ((await db.doc(`users/${user.uid}`).get()).data()?.name as string) || user.email || 'Admin';
    if (action === 'create') {
      const body = typeof text === 'string' ? text.trim() : '';
      if (!body || body.length > 4000) throw new HttpError(400, 'Write a note up to 4,000 characters.');
      const ref = await db.collection('adminNotes').add({
        text: body, topic: typeof topic === 'string' ? topic.trim().slice(0, 60) : '',
        authorId: user.uid, authorName: name, pinned: false, resolved: false, createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ id: ref.id });
    }
    if (!isId(id)) throw new HttpError(400, 'Choose a note.');
    const ref = db.doc(`adminNotes/${id}`);
    const note = (await ref.get()).data();
    if (!note) throw new HttpError(404, 'Note not found.');
    if (action === 'pin' || action === 'resolve') {
      if (typeof value !== 'boolean') throw new HttpError(400, 'Choose on or off.');
      await ref.update({ [action === 'pin' ? 'pinned' : 'resolved']: value, updatedBy: user.uid, updatedByName: name, updatedAt: FieldValue.serverTimestamp() });
    } else if (action === 'delete') {
      if (note.authorId !== user.uid) throw new HttpError(403, 'Only the author can delete a note.');
      await ref.delete();
    } else {
      throw new HttpError(400, 'Choose an action.');
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
