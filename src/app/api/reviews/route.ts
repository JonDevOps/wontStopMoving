import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

/**
 * A customer reviews the provider for their completed job: one review per
 * job, and the provider's average rating and count are updated in the same
 * transaction. Happy customers (4–5 stars) are offered the Google review link
 * when GOOGLE_REVIEW_URL is set.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const { jobId, rating: rawRating, comment } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, 'Choose a move.');
    const rating = typeof rawRating === 'number' && Number.isInteger(rawRating) ? rawRating : 0;
    if (rating < 1 || rating > 5) throw new HttpError(400, 'Choose a rating from 1 to 5 stars.');
    const text = typeof comment === 'string' ? comment.trim().slice(0, 2000) : '';
    const db = adminDb();
    const profile = (await db.doc(`users/${user.uid}`).get()).data();
    const first = String(profile?.firstName || profile?.name || '').trim().split(/\s+/)[0] || 'Customer';
    const lastInitial = String(profile?.lastName || String(profile?.name || '').trim().split(/\s+/)[1] || '').trim().charAt(0);
    const displayName = `${first}${lastInitial ? ` ${lastInitial.toUpperCase()}.` : ''}`.slice(0, 40);

    await db.runTransaction(async tx => {
      const jobRef = db.doc(`jobs/${jobId}`);
      const job = (await tx.get(jobRef)).data();
      if (!job || job.customerId !== user.uid) throw new HttpError(404, 'Move not found.');
      if (job.status !== 'completed') throw new HttpError(409, 'You can review your mover once the move is complete.');
      if (job.reviewed) throw new HttpError(409, 'You already reviewed this move. Thank you!');
      const providerId = Array.isArray(job.providerIds) ? job.providerIds[0] : null;
      if (!isId(providerId)) throw new HttpError(409, 'This move has no assigned provider to review.');
      const providerRef = db.doc(`providers/${providerId}`);
      const provider = (await tx.get(providerRef)).data();
      const count = Number(provider?.reviewCount || 0), avg = Number(provider?.rating || 0);
      tx.create(db.doc(`providers/${providerId}/reviews/${jobId}`), { jobId, providerId, customerId: user.uid, customerName: displayName, rating, comment: text, createdAt: FieldValue.serverTimestamp() });
      tx.update(jobRef, { reviewed: true, reviewRating: rating });
      if (provider) tx.update(providerRef, { reviewCount: count + 1, rating: Math.round(((avg * count + rating) / (count + 1)) * 100) / 100 });
    });
    const googleReviewUrl = rating >= 4 && process.env.GOOGLE_REVIEW_URL?.startsWith('https://') ? process.env.GOOGLE_REVIEW_URL : null;
    return NextResponse.json({ saved: true, googleReviewUrl });
  } catch (error) { return errorResponse(error); }
}
