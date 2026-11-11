import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { loadState } from './registry-store';
import { classifyMover, jevConfigured, type MoverKind } from './jev';
import { lookupSos, sosSearchUrl, type SosRecord } from './sos';
import { stateSummaries } from './registry-query';
import type { Mover } from '@/lib/registry';

/**
 * Extra facts about registry companies, cached in registryEnrichment/{dot}:
 * Jev's classification (local mover, van line, broker...) and the state
 * business-registry record where the state publishes one for free.
 */
export type Enrichment = {
  kind?: MoverKind; kindConfidence?: number; classifiedAt?: string | null;
  sos?: { best: SosRecord | null; matches: SosRecord[]; checkedAt: string | null; free: boolean; searchUrl: string };
  competitorId?: string | null;
};

const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function enrichmentFor(dots: string[]): Promise<Map<string, Enrichment>> {
  const db = adminDb(), out = new Map<string, Enrichment>();
  for (let i = 0; i < dots.length; i += 300) {
    const refs = dots.slice(i, i + 300).map(d => db.doc(`registryEnrichment/${d}`));
    if (!refs.length) continue;
    for (const snap of await db.getAll(...refs)) {
      if (!snap.exists) continue;
      const e = snap.data()!;
      out.set(snap.id, { kind: e.kind, kindConfidence: e.kindConfidence, classifiedAt: iso(e.classifiedAt), sos: e.sos ? { ...e.sos, checkedAt: iso(e.sos.checkedAt) } : undefined, competitorId: e.competitorId || null });
    }
  }
  return out;
}

export async function classifyAndSave(m: Mover) {
  const r = await classifyMover(m);
  await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, kind: r.kind, kindConfidence: r.confidence, kindProbabilities: r.probabilities, jevModel: r.model, classifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  return r;
}

/** Business-registry record, cached for a week. */
export async function sosFor(m: Mover, refresh = false) {
  const ref = adminDb().doc(`registryEnrichment/${m.dot}`);
  const cached = (await ref.get()).data()?.sos;
  const week = 7 * 86400_000;
  if (!refresh && cached?.checkedAt && Date.now() - cached.checkedAt.toMillis() < week) return { ...cached, checkedAt: iso(cached.checkedAt) };
  const result = await lookupSos(m.state, [m.name, m.dba]);
  const sos = { best: result?.best || null, matches: result?.matches || [], free: !!result, searchUrl: sosSearchUrl(m.state), checkedAt: FieldValue.serverTimestamp() };
  await ref.set({ dot: m.dot, state: m.state, sos }, { merge: true });
  return { ...sos, checkedAt: new Date().toISOString() };
}

/** Runs `fn` over items with limited parallelism until the deadline. */
async function pool<T>(items: T[], limit: number, deadline: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length && Date.now() < deadline) { const t = items[i++]; try { await fn(t); } catch (error) { console.error('Registry enrichment failed', error); } }
  }));
}

/**
 * Hourly: Jev-classify each state's biggest likely movers (top 300 per
 * state, California and Washington first) that aren't classified yet.
 */
export async function runEnrichment(budgetMs = 45_000) {
  if (!jevConfigured()) return { classified: 0, skipped: 'Jev is not configured' };
  const deadline = Date.now() + budgetMs;
  const summaries = (await stateSummaries(true)).sort((a, b) => (['CA', 'WA'].includes(b.state) ? 1 : 0) - (['CA', 'WA'].includes(a.state) ? 1 : 0));
  let classified = 0;
  for (const s of summaries) {
    if (Date.now() > deadline) break;
    const dots = s.top.map(t => String(t.dot));
    const known = await enrichmentFor(dots);
    const todo = dots.filter(d => !known.get(d)?.kind);
    if (!todo.length) continue;
    const rows = new Map((await loadState(s.state)).map(m => [m.dot, m]));
    await pool(todo.map(d => rows.get(d)).filter(Boolean) as Mover[], 6, deadline, async m => { await classifyAndSave(m); classified++; });
  }
  return { classified };
}
