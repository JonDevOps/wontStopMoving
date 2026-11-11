import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { ZIPS } from './geo';
import { setAssignment } from './assignments';
import { milesBetween, zipOf } from '@/lib/market';

/**
 * Automatic routing for new bookings: the closest approved provider or
 * agent (agents must serve the pickup state; providers must be free that
 * day), plus a backup. Assigns the closest one automatically unless turned
 * off under Market Radar → Settings; the choice is logged in the job history.
 */
export type RouteChoice = { kind: 'provider' | 'agent'; id: string; name: string; miles: number };

export async function routingSettings() {
  const s = (await adminDb().doc('marketSettings/routing').get()).data() || {};
  return { autoAssign: s.autoAssign !== false, maxMiles: Number(s.maxMiles) > 0 ? Number(s.maxMiles) : 75 };
}

export async function routeCandidates(job: Record<string, any>, jobId: string, maxMiles: number): Promise<RouteChoice[]> {
  const zip = zipOf(job.pickupAddress) || String(job.pickupZip || '').slice(0, 5);
  const center = ZIPS[zip];
  if (!center) return [];
  const db = adminDb();
  const [providers, agents, sameDay] = await Promise.all([
    db.collection('providers').where('status', '==', 'approved').get(),
    db.collection('agents').where('status', '==', 'approved').get(),
    job.moveDate ? db.collection('jobs').where('moveDate', '==', job.moveDate).select('providerIds', 'status').get() : Promise.resolve(null),
  ]);
  const busy = new Set<string>();
  for (const d of sameDay?.docs || []) if (d.id !== jobId && d.data().status !== 'cancelled') for (const id of d.data().providerIds || []) busy.add(id);
  const pickupState = typeof job.state === 'string' && job.state.length === 2 ? job.state : '';
  const out: RouteChoice[] = [];
  for (const d of providers.docs) {
    const p = d.data();
    if (busy.has(d.id) || (Array.isArray(p.unavailableDates) && p.unavailableDates.includes(job.moveDate))) continue;
    const ll: [number, number] | undefined = p.location?.lat ? [p.location.lat, p.location.lng] : ZIPS[String(p.zipCode || '').slice(0, 5)];
    if (ll) out.push({ kind: 'provider', id: d.id, name: p.businessName || p.name || 'Provider', miles: Math.round(milesBetween(center, ll) * 10) / 10 });
  }
  for (const d of agents.docs) {
    const a = d.data();
    if (pickupState && Array.isArray(a.serviceRegions) && !a.serviceRegions.includes(`US-${pickupState}`)) continue;
    const ll = ZIPS[String(a.postalCode || '').slice(0, 5)];
    if (ll) out.push({ kind: 'agent', id: d.id, name: a.companyName || 'Agent', miles: Math.round(milesBetween(center, ll) * 10) / 10 });
  }
  return out.filter(c => c.miles <= maxMiles).sort((a, b) => a.miles - b.miles);
}

/** Called after a booking is paid. Never throws. */
export async function routeNewJob(jobId: string) {
  try {
    const db = adminDb(), ref = db.doc(`jobs/${jobId}`);
    const job = (await ref.get()).data();
    if (!job || job.routing) return null;
    const settings = await routingSettings();
    const [primary, backup] = await routeCandidates(job, jobId, settings.maxMiles);
    const alreadyAssigned = (job.providerIds || []).length > 0 || (job.agentIds || []).length > 0;
    let autoAssigned = false;
    if (primary && settings.autoAssign && !alreadyAssigned) {
      autoAssigned = await setAssignment({ jobId, kind: primary.kind, assigneeId: primary.id, agentRole: primary.kind === 'agent' ? 'origin' : undefined, note: `Auto-routed: closest available (${primary.miles} mi)${backup ? `. Backup: ${backup.name} (${backup.miles} mi)` : ''}`, actor: { uid: 'system', name: 'Auto-routing', role: 'system' } });
    }
    await ref.update({ routing: { primary: primary || null, backup: backup || null, autoAssigned, computedAt: FieldValue.serverTimestamp() } });
    return { primary, backup, autoAssigned };
  } catch (error) { console.error('Routing failed', jobId, error); return null; }
}
