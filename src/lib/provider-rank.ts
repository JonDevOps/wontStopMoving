/**
 * Provider ranking for "Featured" (#147). Modeled on how moving-labor
 * marketplaces rank crews: a rating that's only trusted once enough reviews
 * back it up, proven completed jobs, reliability, verification, a complete
 * profile, and time on the platform. Pure function so it can be tested.
 */
export type RankInput = {
  rating: number; reviewCount: number; jobsCompleted: number; cancellations: number;
  verified: boolean; bioLength: number; services: number; monthsOnPlatform: number; adminFeatured: boolean;
};

const PRIOR_RATING = 4.3, PRIOR_WEIGHT = 5;

/** Rating pulled toward 4.3 until a provider has several reviews (Bayesian average). */
export const trustedRating = (rating: number, reviews: number) =>
  reviews > 0 ? (rating * reviews + PRIOR_RATING * PRIOR_WEIGHT) / (reviews + PRIOR_WEIGHT) : PRIOR_RATING;

export function providerScore(p: RankInput) {
  const rating = (trustedRating(p.rating, p.reviewCount) / 5) * 45;            // up to 45
  const experience = Math.min(p.jobsCompleted, 40) / 40 * 20;                   // up to 20
  const reviewsVolume = Math.min(p.reviewCount, 25) / 25 * 10;                  // up to 10
  const finished = p.jobsCompleted + p.cancellations;
  const reliability = finished ? (p.jobsCompleted / finished) * 10 : 7;         // up to 10
  const verified = p.verified ? 8 : 0;                                           // 8
  const profile = (p.bioLength >= 80 ? 2 : 0) + (p.services >= 2 ? 1 : 0);      // up to 3
  const tenure = Math.min(p.monthsOnPlatform, 12) / 12 * 4;                      // up to 4
  return Math.round((rating + experience + reviewsVolume + reliability + verified + profile + tenure) * 10) / 10;
}

/** "Top rated": strong trusted rating backed by real reviews and completed jobs. */
export const isTopRated = (p: RankInput) => trustedRating(p.rating, p.reviewCount) >= 4.6 && p.reviewCount >= 5 && p.jobsCompleted >= 5;

/**
 * Marks the featured providers in a result set: the top 3 by score that are
 * top rated (or that an admin featured), then sorts featured first by score.
 */
export function rankProviders<T extends { id: string; rank: RankInput }>(list: T[]) {
  const scored = list.map(p => ({ ...p, score: providerScore(p.rank), topRated: isTopRated(p.rank) }))
    .sort((a, b) => b.score - a.score);
  const featuredIds = new Set(scored.filter(p => p.rank.adminFeatured).map(p => p.id));
  for (const p of scored) { if (featuredIds.size >= 3 + scored.filter(x => x.rank.adminFeatured).length) break; if (p.topRated) featuredIds.add(p.id); }
  return scored.map(p => ({ ...p, featured: featuredIds.has(p.id) }))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.score - a.score);
}
