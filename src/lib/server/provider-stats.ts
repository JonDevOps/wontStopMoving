import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { RankInput } from '@/lib/provider-rank';

/** Ranking inputs for a provider: profile fields plus completed and cancelled job counts. */
export async function rankInput(db: Firestore, id: string, p: DocumentData): Promise<RankInput> {
  const jobs = db.collection('jobs').where('providerIds', 'array-contains', id);
  const [completed, cancelled] = await Promise.all([
    jobs.where('status', '==', 'completed').count().get(),
    jobs.where('status', '==', 'cancelled').count().get(),
  ]);
  const created = p.createdAt?.toMillis?.() ?? null;
  return {
    rating: typeof p.rating === 'number' ? p.rating : 0,
    reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : 0,
    jobsCompleted: completed.data().count,
    cancellations: cancelled.data().count,
    verified: p.onboarding?.insuranceUploaded === true,
    bioLength: typeof p.bio === 'string' ? p.bio.trim().length : 0,
    services: Array.isArray(p.services) ? p.services.length : 0,
    monthsOnPlatform: created ? Math.max(0, (Date.now() - created) / (30 * 86400000)) : 0,
    adminFeatured: p.featured === true,
  };
}
