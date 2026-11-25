import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { normalizeSmsPhone } from '@/lib/sms-consent';

/** Phone inbox and call log (#159), plus the caller blocklist (#182). */
const digits = (phone: string) => phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

export async function GET(req: Request) { try {
  await requireRole(req, ['admin']);
  const db = adminDb();
  const [inbox, blocked] = await Promise.all([db.collection('phoneInbox').orderBy('createdAt', 'desc').limit(100).get(), db.collection('phoneBlocklist').limit(500).get()]);
  const blockedSet = new Set(blocked.docs.map(d => d.id));
  return NextResponse.json({ items: inbox.docs.map(d => { const x = d.data(); return {
    id: d.id, kind: x.kind, phone: x.phone, body: x.body || '', mediaCount: x.mediaCount || 0, status: x.status,
    choice: x.choice || null, knownName: x.knownName || null, knownRole: x.knownRole || null, callerName: x.callerName || null,
    queueSeconds: x.queueSeconds ?? null, blocked: !!x.phone && blockedSet.has(digits(x.phone)),
    createdAt: x.createdAt?.toDate?.().toISOString() || null, answeredAt: x.answeredAt?.toDate?.().toISOString() || null,
  }; }) }, { headers: { 'Cache-Control': 'private, no-store' } });
} catch (error) { return errorResponse(error); } }

export async function POST(req: Request) { try {
  const { user } = await requireRole(req, ['admin']);
  const { action, phone } = await readJson(req);
  const normalized = normalizeSmsPhone(phone);
  if (!normalized) throw new HttpError(400, 'Choose a phone number.');
  const ref = adminDb().doc(`phoneBlocklist/${digits(normalized)}`);
  if (action === 'block') await ref.set({ phone: normalized, blockedBy: user.uid, blockedAt: FieldValue.serverTimestamp() });
  else if (action === 'unblock') await ref.delete();
  else throw new HttpError(400, 'Choose an action.');
  return NextResponse.json({ ok: true });
} catch (error) { return errorResponse(error); } }
