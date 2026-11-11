import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { actorFor, setAssignment } from '@/lib/server/assignments';
import { rankProviders, type DispatchProvider } from '@/lib/dispatch';

/** Suggested providers for a job, and assigning one (which emails them the job). */
async function completedCounts() {
  const snap = await adminDb().collection('jobs').where('status', '==', 'completed').select('providerIds').limit(5000).get();
  const counts = new Map<string, number>();
  for (const d of snap.docs) for (const id of d.data().providerIds || []) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!isId(jobId)) throw new HttpError(400, 'Choose a job.');
    const db = adminDb();
    const job = (await db.doc(`jobs/${jobId}`).get()).data();
    if (!job) throw new HttpError(404, 'Job not found.');
    const [providers, counts, sameDay] = await Promise.all([
      db.collection('providers').limit(1000).get(),
      completedCounts(),
      job.moveDate ? db.collection('jobs').where('moveDate', '==', job.moveDate).limit(500).get() : Promise.resolve(null),
    ]);
    const busy = new Set<string>();
    for (const d of sameDay?.docs || []) if (d.id !== jobId && d.data().status !== 'cancelled') for (const id of d.data().providerIds || []) busy.add(id);
    const list: DispatchProvider[] = providers.docs.map(d => {
      const p = d.data();
      return { id: d.id, name: p.businessName || p.name || 'Provider', status: p.status, payoutsReady: !!p.stripeOnboardingComplete, state: p.state, zipCode: p.zipCode, rating: p.rating, reviewCount: p.reviewCount, completedJobs: counts.get(d.id) || 0, availableDays: p.availableDays, unavailableDates: p.unavailableDates };
    });
    const candidates = rankProviders({ state: job.state, zip: job.pickupAddress, moveDate: job.moveDate }, list, busy).slice(0, 15);
    return NextResponse.json({ candidates, assigned: job.providerIds || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { jobId, providerId } = await readJson(req);
    if (!isId(jobId) || !isId(providerId)) throw new HttpError(400, 'Choose a job and a provider.');
    // Logged in the move's activity history; emails the provider.
    await setAssignment({ jobId, kind: 'provider', assigneeId: providerId, actor: await actorFor(user.uid, 'admin', user.email), note: 'Suggested match' });
    return NextResponse.json({ assigned: true });
  } catch (error) { return errorResponse(error); }
}
