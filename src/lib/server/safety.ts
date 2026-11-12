import { adminDb } from './firebase-admin';
import { activeInsuranceFor, authorityFor, crashesFor, inspectionsFor, insuranceCancellationsFor, revocationsFor } from './fmcsa';
import { recentTrouble, summarizeSafety, type Safety } from '@/lib/safety';
import type { Mover } from '@/lib/registry';

/**
 * A company's activity, safety and trouble signals from free FMCSA data
 * (see src/lib/safety.ts). Public government data, so it's saved:
 * registryEnrichment/{dot}.safety, refreshed after a week.
 */
const WEEK = 7 * 86400_000;
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function cachedSafety(dot: string): Promise<(Safety & { checkedAt: string | null }) | null> {
  const s = (await adminDb().doc(`registryEnrichment/${dot}`).get()).data()?.safety;
  return s ? { ...s, checkedAt: iso(s.checkedAt) } : null;
}

export async function safetyFor(m: Mover, refresh = false): Promise<Safety & { checkedAt: string | null }> {
  const ref = adminDb().doc(`registryEnrichment/${m.dot}`);
  const cached = (await ref.get()).data()?.safety;
  const age = cached?.checkedAt ? Date.now() - cached.checkedAt.toMillis() : Infinity;
  if (cached && (age < 10 * 60_000 || (!refresh && age < WEEK))) return { ...cached, checkedAt: iso(cached.checkedAt) };
  const today = new Date().toISOString().slice(0, 10);
  const [inspections, crashes, cancels, revokes, active, authority] = await Promise.all([
    inspectionsFor(m.dot), crashesFor(m.dot), insuranceCancellationsFor([m.dot]), revocationsFor([m.dot]),
    activeInsuranceFor(m.dot).catch(() => []), authorityFor(m.dot).catch(() => []),
  ]);
  const trouble = recentTrouble({
    cancellations: cancels.get(m.dot) || [],
    upcomingCancellations: active.filter(p => p.cancels && p.cancels > today).map(p => ({ date: p.cancels, insurer: p.insurer, kind: p.kind })),
    revocations: revokes.get(m.dot) || [], pendingRevocation: authority.some(a => a.pendingRevocation),
  });
  const safety = summarizeSafety({ inspections, crashes, trouble, units: m.units, homeState: m.state });
  const checkedAt = new Date();
  await ref.set({ dot: m.dot, state: m.state, safety: { ...safety, checkedAt } }, { merge: true });
  return { ...safety, checkedAt: checkedAt.toISOString() };
}
