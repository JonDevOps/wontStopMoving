/**
 * Provider matching for dispatch. Pure (no imports) so it is unit-tested.
 * A provider can be assigned only if approved; the score orders eligible
 * providers by how well they fit this job.
 */
export type DispatchJob = { state?: string; zip?: string; moveDate?: string };
export type DispatchProvider = {
  id: string; name: string; status?: string; payoutsReady?: boolean; state?: string; zipCode?: string;
  rating?: number; reviewCount?: number; completedJobs?: number; availableDays?: number[]; unavailableDates?: string[];
};
export type Candidate = { id: string; name: string; score: number; eligible: boolean; reasons: string[]; warnings: string[] };

const zipOf = (s?: string) => (s || '').match(/\b(\d{5})\b/)?.[1] || '';

export function rankProviders(job: DispatchJob, providers: DispatchProvider[], busyOnDate: Set<string>): Candidate[] {
  const jobZip = zipOf(job.zip);
  const weekday = job.moveDate && /^\d{4}-\d{2}-\d{2}$/.test(job.moveDate) ? new Date(`${job.moveDate}T12:00:00Z`).getUTCDay() : null;
  return providers.map(p => {
    const reasons: string[] = [], warnings: string[] = [];
    let score = 0;
    const eligible = p.status === 'approved';
    if (!eligible) warnings.push('Not approved');
    if (p.payoutsReady) { score += 10; reasons.push('Payouts set up'); } else warnings.push('Payouts not set up');
    if (job.state && p.state && p.state.toLowerCase() === job.state.toLowerCase()) { score += 30; reasons.push(`Serves ${p.state}`); }
    const pZip = zipOf(p.zipCode);
    if (jobZip && pZip) {
      if (pZip === jobZip) { score += 30; reasons.push('Same ZIP'); }
      else if (pZip.slice(0, 3) === jobZip.slice(0, 3)) { score += 20; reasons.push('Nearby'); }
    }
    if (job.moveDate && (p.unavailableDates || []).includes(job.moveDate)) { score -= 100; warnings.push('Marked unavailable that day'); }
    else if (weekday !== null && Array.isArray(p.availableDays) && p.availableDays.length && !p.availableDays.includes(weekday)) { score -= 40; warnings.push('Doesn’t usually work that weekday'); }
    if (busyOnDate.has(p.id)) { score -= 60; warnings.push('Already booked that day'); }
    const rating = Number(p.rating || 0), reviews = Number(p.reviewCount || 0);
    if (reviews > 0) { score += Math.round(rating * 4); reasons.push(`${rating.toFixed(1)}★ (${reviews})`); }
    const done = Number(p.completedJobs || 0);
    if (done > 0) { score += Math.min(done, 20); reasons.push(`${done} job${done === 1 ? '' : 's'} done`); }
    return { id: p.id, name: p.name, score, eligible, reasons, warnings };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.name.localeCompare(b.name));
}
