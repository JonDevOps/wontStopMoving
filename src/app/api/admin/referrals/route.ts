import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

/** Referral rewards for the team to issue, and marking them paid. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const snap = await db.collection('referrals').orderBy('createdAt', 'desc').limit(200).get();
    const uids = [...new Set(snap.docs.map(d => d.data().referrerUid).filter((v): v is string => typeof v === 'string' && isId(v)))];
    const users = Object.fromEntries(await Promise.all(uids.map(async uid => { const u = (await db.doc(`users/${uid}`).get()).data(); return [uid, { name: u?.name || '', email: u?.email || '' }]; })));
    return NextResponse.json({ referrals: snap.docs.map(d => { const r = d.data(); return { id: d.id, referrer: users[r.referrerUid] || { name: '', email: '' }, referredName: r.referredName, amountUsd: r.amountUsd, status: r.status, createdAt: r.createdAt?.toDate?.().toISOString() || null, paidAt: r.paidAt?.toDate?.().toISOString() || null }; }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { id, note } = await readJson(req);
    if (!isId(id)) throw new HttpError(400, 'Choose a referral.');
    const ref = adminDb().doc(`referrals/${id}`);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Referral not found.');
    await ref.update({ status: 'paid', paidAt: FieldValue.serverTimestamp(), paidBy: user.uid, paidNote: typeof note === 'string' ? note.slice(0, 300) : '' });
    return NextResponse.json({ status: 'paid' });
  } catch (error) { return errorResponse(error); }
}
