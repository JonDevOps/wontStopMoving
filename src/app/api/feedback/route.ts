import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson } from '@/lib/server/auth';

/**
 * Customer satisfaction after a support ticket or service request is
 * resolved. The link in the resolution email carries the record's random
 * token, so no sign-in is needed. A later rating replaces an earlier one.
 */
export async function POST(req: Request) {
  try {
    const { kind, id, token, score, comment } = await readJson(req);
    const collection = kind === 'ticket' ? 'supportTickets' : kind === 'request' ? 'serviceRequests' : null;
    if (!collection || !isId(id) || typeof token !== 'string' || !/^[a-f0-9]{36}$/.test(token)) throw new HttpError(400, 'This feedback link is invalid.');
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) throw new HttpError(400, 'Choose a rating from 1 to 5.');
    const ref = adminDb().doc(`${collection}/${id}`);
    const stored = (await ref.get()).data()?.feedbackToken;
    if (typeof stored !== 'string' || stored.length !== token.length || !timingSafeEqual(Buffer.from(stored), Buffer.from(token))) throw new HttpError(400, 'This feedback link is invalid.');
    await ref.update({ satisfaction: score, satisfactionComment: typeof comment === 'string' ? comment.trim().slice(0, 1000) : '', satisfactionAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}
