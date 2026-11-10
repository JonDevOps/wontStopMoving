import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { isId } from '@/lib/server/auth';
import { suppressionId } from '@/lib/server/followups';

/**
 * Stops quote follow-up emails. Works from the unsubscribe page and as an
 * RFC 8058 one-click unsubscribe (mail apps POST to the List-Unsubscribe URL).
 * The quote ID and its random token come from the link in the email.
 */
async function unsubscribe(quoteId: unknown, token: unknown) {
  if (!isId(quoteId) || typeof token !== 'string' || !/^[a-f0-9]{36}$/.test(token)) return false;
  const db = adminDb(), ref = db.doc(`quotes/${quoteId}`);
  const q = (await ref.get()).data();
  const stored = typeof q?.followUpToken === 'string' ? q.followUpToken : '';
  if (!q || stored.length !== token.length || !timingSafeEqual(Buffer.from(stored), Buffer.from(token))) return false;
  await ref.update({ followUpsStopped: true, followUpsStoppedReason: 'unsubscribed', followUpsStoppedAt: FieldValue.serverTimestamp() });
  if (typeof q.email === 'string' && q.email.includes('@')) {
    await db.doc(`emailSuppressions/${suppressionId(q.email)}`).set({ source: 'quote-follow-up', quoteId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return true;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let quoteId: unknown = url.searchParams.get('q'), token: unknown = url.searchParams.get('t');
  if (req.headers.get('content-type')?.includes('application/json')) {
    try { const body = await req.json(); quoteId = body.quoteId ?? quoteId; token = body.token ?? token; } catch { /* use the query string */ }
  }
  const ok = await unsubscribe(quoteId, token);
  return NextResponse.json(ok ? { unsubscribed: true } : { error: 'This unsubscribe link is invalid.' }, { status: ok ? 200 : 400 });
}
