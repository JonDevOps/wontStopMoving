import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { loadPartners, loadState } from './registry-store';
import { radarSettings, watchedStates } from './market';
import { servicesLabel, tupleToMover } from '@/lib/carriers';
import { classifyMover, classifyPartner, classifyStrategy, jevConfigured, type MoverKind, type PartnerFit, type Strategy, type StrategySignals } from './jev';
import { lookupSos, sosSearchUrl, type SosRecord } from './sos';
import { stateSummaries } from './registry-query';
import { runPriceIndex } from './price-index';
import { refreshStaleSocialStats } from './competitors';
import type { Mover } from '@/lib/registry';

/**
 * Extra facts about registry companies, cached in registryEnrichment/{dot}:
 * Jev's classification (local mover, van line, broker...) and the state
 * business-registry record where the state publishes one for free.
 */
export type Enrichment = {
  kind?: MoverKind; kindConfidence?: number; classifiedAt?: string | null;
  partnerFit?: PartnerFit; partnerFitConfidence?: number;
  sos?: { best: SosRecord | null; matches: SosRecord[]; checkedAt: string | null; free: boolean; searchUrl: string };
  competitorId?: string | null;
  placeId?: string | null; placeCheckedAt?: string | null;
  site?: string | null; socials?: Record<string, string>;
  strategy?: Strategy; strategyConfidence?: number; strategyAt?: string | null;
  socialStats?: Record<string, unknown>;
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
      out.set(snap.id, { kind: e.kind, kindConfidence: e.kindConfidence, partnerFit: e.partnerFit, partnerFitConfidence: e.partnerFitConfidence, classifiedAt: iso(e.classifiedAt), sos: e.sos ? { ...e.sos, checkedAt: iso(e.sos.checkedAt) } : undefined, competitorId: e.competitorId || null, placeId: e.placeId, placeCheckedAt: iso(e.placeCheckedAt), site: e.web?.site || null, socials: e.web?.socials || {}, strategy: e.strategy, strategyConfidence: e.strategyConfidence, strategyAt: iso(e.strategyAt), socialStats: e.socialStats });
    }
  }
  return out;
}

/** Jev's call on how we should treat this company (partner, study, compete, acquire, ignore). */
export async function strategyAndSave(m: Mover, signals: StrategySignals) {
  const r = await classifyStrategy(m, signals);
  await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, strategy: r.strategy, strategyConfidence: r.confidence, strategyProbabilities: r.probabilities, strategyAt: FieldValue.serverTimestamp() }, { merge: true });
  return r;
}

export async function classifyAndSave(m: Mover) {
  const r = await classifyMover(m);
  await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, kind: r.kind, kindConfidence: r.confidence, kindProbabilities: r.probabilities, jevModel: r.model, classifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  return r;
}

/** Jev's partner fit for a carrier on the partner shortlist. */
export async function classifyPartnerAndSave(m: Mover) {
  const r = await classifyPartner({ ...m, services: servicesLabel(m) });
  await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, partnerFit: r.fit, partnerFitConfidence: r.confidence, partnerFitProbabilities: r.probabilities, jevModel: r.model, partnerClassifiedAt: FieldValue.serverTimestamp() }, { merge: true });
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
  const deadline = Date.now() + budgetMs;
  // Jev sorts movers for the first ~45% of the run and the partner shortlist for ~15%; the price index gets the rest.
  const classified = jevConfigured() ? await classifyTop(Date.now() + budgetMs * 0.45) : 0;
  let partners = 0;
  if (jevConfigured()) { try { partners = await classifyPartners(Date.now() + budgetMs * 0.15); } catch (error) { console.error('Partner sorting failed', error); } }
  // Instagram/YouTube numbers for tracked competitors: a few each hour, weekly per company (up to ~10s).
  let social = 0;
  try { social = await refreshStaleSocialStats(5, Math.min(deadline, Date.now() + 10_000)); } catch (error) { console.error('Social stats refresh failed', error); }
  let priced = 0;
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) { try { priced = (await runPriceIndex(deadline)).priced; } catch (error) { console.error('Price index failed', error); } }
  return { classified, partners, priced, social };
}

async function classifyTop(deadline: number) {
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
  return classified;
}

/**
 * The partner shortlist in your watched areas (Market radar settings; the
 * Bay Area and Puget Sound states until set): Jev asks how each of the best
 * 200 per state could work with us. Only the shortlist, never all 1.3M
 * carriers, to keep the cost small.
 */
export const PARTNER_JEV_PER_STATE = 200;
async function classifyPartners(deadline: number) {
  const settings = await radarSettings().catch(() => null);
  const states = settings ? watchedStates(settings) : [];
  let classified = 0;
  for (const state of states.length ? states : ['CA', 'WA']) {
    if (Date.now() > deadline) break;
    const top = (await loadPartners(state)).slice(0, PARTNER_JEV_PER_STATE);
    const known = await enrichmentFor(top.map(t => t[0]));
    const todo = top.filter(t => !known.get(t[0])?.partnerFit).map(t => tupleToMover(t, state, null));
    await pool(todo, 6, deadline, async m => { await classifyPartnerAndSave(m); classified++; });
  }
  return classified;
}
