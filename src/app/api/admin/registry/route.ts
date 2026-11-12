import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { CARRIER_TYPES, ourFleet, searchRegistry, stateSummaries, type CarrierType, type RegistryQuery } from '@/lib/server/registry-query';
import { classifyAndSave, classifyPartnerAndSave, enrichmentFor } from '@/lib/server/registry-enrich';
import { syncState } from '@/lib/server/registry-sync';
import { trackedByDot, trackMovers } from '@/lib/server/registry-track';
import { loadManifest, loadPartners, loadState } from '@/lib/server/registry-store';
import { adminDb } from '@/lib/server/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { REGION_BY_CODE } from '@/lib/agents';
import { importDue, servicesLabel, tupleToMover } from '@/lib/carriers';
import { jevConfigured } from '@/lib/server/jev';
import { moversCsv, REGION_PRESETS, REGISTRY_AREAS, yearsInBusiness, type Mover, type SortKey } from '@/lib/registry';

/**
 * The national mover registry (free FMCSA data): search, map points, our
 * rank, CSV export, and bulk actions (track as competitors, classify, refresh).
 */
export const maxDuration = 60;
const SORTS: SortKey[] = ['size', 'units', 'drivers', 'miles', 'years', 'newest', 'name', 'distance', 'score'];
const n = (v: string | null) => (v === null || v === '' ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);

function parseQuery(p: URLSearchParams | Record<string, unknown>): RegistryQuery {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k] === undefined || p[k] === null ? null : String(p[k]));
  const states = (get('states') || '').toUpperCase().split(',').map(s => s.trim()).filter(s => REGISTRY_AREAS.includes(s));
  const [south, west, north, east] = ['south', 'west', 'north', 'east'].map(k => n(get(k)));
  const [nearLat, nearLng, nearMiles] = ['nearLat', 'nearLng', 'nearMiles'].map(k => n(get(k)));
  const region = get('region') || undefined;
  return {
    type: CARRIER_TYPES.includes(get('type') as Exclude<CarrierType, ''>) ? (get('type') as CarrierType) : undefined,
    q: (get('q') || '').slice(0, 80) || undefined, states, region: region && REGION_PRESETS[region] ? region : undefined,
    city: (get('city') || '').slice(0, 60) || undefined, zip: /^\d{3,5}$/.test(get('zip') || '') ? get('zip')! : undefined,
    bbox: [south, west, north, east].every(v => v !== undefined) ? { south: south!, west: west!, north: north!, east: east! } : undefined,
    near: nearLat !== undefined && nearLng !== undefined ? { lat: nearLat, lng: nearLng, miles: Math.min(nearMiles || 25, 500) } : undefined,
    minUnits: n(get('minUnits')), maxUnits: n(get('maxUnits')), minDrivers: n(get('minDrivers')), minYears: n(get('minYears')),
    addedSince: /^\d+$/.test(get('newDays') || '') ? new Date(Date.now() - Math.min(Number(get('newDays')), 3650) * 86400000).toISOString().slice(0, 10) : undefined,
    interstate: get('interstate') === 'yes' || get('interstate') === 'no' ? (get('interstate') as 'yes' | 'no') : undefined,
    hhgAuth: get('hhg') === '1', likelyOnly: get('likely') !== '0', hasEmail: get('email') === '1', hasSite: get('site') === '1', noSite: get('site') === '0',
    org: (get('org') || '').slice(0, 30) || undefined,
    sort: SORTS.includes(get('sort') as SortKey) ? (get('sort') as SortKey) : undefined,
    page: n(get('page')), pageSize: n(get('pageSize')), rankBy: (['size', 'units', 'drivers'] as const).find(k => k === get('rankBy')),
  };
}

/** Filters that need cached enrichment (Jev kind, registry status, tracked). */
async function applyEnrichmentFilters(rows: Mover[], p: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : (p[k] as string | undefined) ?? null);
  const kinds = (get('kind') || '').split(',').filter(Boolean);
  const sos = get('sos'), tracked = get('tracked');
  if (!kinds.length && !sos && !tracked) return null;
  const capped = rows.slice(0, 5000);
  const [enr, trackedMap] = await Promise.all([enrichmentFor(capped.map(m => m.dot)), tracked ? trackedByDot() : Promise.resolve(new Map<string, string>())]);
  return capped.filter(m => {
    const e = enr.get(m.dot);
    if (kinds.length && !(e?.kind && kinds.includes(e.kind))) return false;
    if (sos === 'active' && e?.sos?.best?.active !== true) return false;
    if (sos === 'inactive' && e?.sos?.best?.active !== false) return false;
    if (tracked === '1' && !trackedMap.has(m.dot)) return false;
    if (tracked === '0' && trackedMap.has(m.dot)) return false;
    return true;
  });
}

async function decorate(rows: Mover[]) {
  const [enr, tracked] = await Promise.all([enrichmentFor(rows.map(m => m.dot)), trackedByDot()]);
  return rows.map(m => {
    const e = enr.get(m.dot);
    return { ...m, years: yearsInBusiness(m), partnerFit: e?.partnerFit || null, partnerFitConfidence: e?.partnerFitConfidence ?? null, kind: e?.kind || null, kindConfidence: e?.kindConfidence ?? null, sosActive: e?.sos?.best ? e.sos.best.active : null, sosChecked: !!e?.sos?.checkedAt, competitorId: tracked.get(m.dot) || null };
  });
}

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const params = new URL(req.url).searchParams;
    const query = parseQuery(params);
    const csv = params.get('format') === 'csv';
    const needsEnrichment = ['kind', 'sos', 'tracked'].some(k => params.get(k));
    const result = await searchRegistry(query, await ourFleet(), { points: params.get('map') === '1' && !params.get('vbSouth'), all: csv || needsEnrichment });
    // The map shows every company in view (same filters), whatever area the list is set to.
    if (params.get('map') === '1' && params.get('vbSouth')) {
      const [south, west, north, east] = ['vbSouth', 'vbWest', 'vbNorth', 'vbEast'].map(k => Number(params.get(k)));
      if ([south, west, north, east].every(Number.isFinite)) {
        const view = await searchRegistry({ ...query, region: undefined, states: [], near: undefined, bbox: { south, west, north, east }, page: 1, pageSize: 1 }, null, { points: true });
        result.points = view.points;
      }
    }
    let rows = result.rows, total = result.total;
    if (needsEnrichment) {
      const filtered = (await applyEnrichmentFilters(result.all || [], params)) || [];
      total = filtered.length;
      const size = Math.min(Math.max(query.pageSize || 50, 1), 200), page = Math.max(query.page || 1, 1);
      rows = csv ? filtered : filtered.slice((page - 1) * size, page * size);
    } else if (csv) rows = result.all || [];
    if (csv) {
      return new NextResponse(moversCsv(rows.slice(0, 20000), Date.now(), servicesLabel), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${query.type ? 'carriers' : 'movers'}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' } });
    }
    const summaries = await stateSummaries();
    const type = query.type;
    // State totals for the map: likely movers, or the chosen kind of carrier.
    const stateCount = (s: (typeof summaries)[number]) => (!type ? s.likely : type === 'partners' ? s.partners ?? 0 : s.categories?.[type] ?? 0);
    return NextResponse.json({
      needsArea: 'needsArea' in result ? result.needsArea : false, import: params.get('stats') === '1' ? await importStatus() : undefined,
      mode: result.mode, nationalComplete: result.nationalComplete ?? null, total, rows: await decorate(rows), rank: result.rank, explain: result.explain, points: result.points, totals: result.totals, updatedAt: result.updatedAt,
      synced: summaries.length, jev: jevConfigured(),
      stateStats: params.get('stats') === '1' ? summaries.map(s => ({ state: s.state, count: s.count, likely: stateCount(s), units: s.units, center: s.center, updatedAt: s.updatedAt })) : undefined,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** When the DOT census file was last imported, what's next, and the data dictionary on file. */
async function importStatus() {
  const m = await loadManifest();
  if (!m) return null;
  const due = importDue(m);
  return {
    generatedAt: m.generatedAt, runs: m.runs, sourceUpdatedAt: m.sourceUpdatedAt, schedule: m.runs < 3 ? 'daily (first 3 imports)' : 'weekly',
    nextCheck: due.reason, totals: m.totals, columns: m.columns, dictionary: m.dictionary,
  };
}

/**
 * { action: 'track', query, limit, tier }: add the top N of a search to the competitor tracker.
 * { action: 'legends' }: the national top 100 likely movers (brokers and non-movers excluded once Jev has sorted them) become legends.
 * { action: 'classify', dots: [{dot, state}], partners? }: Jev-sort up to 40 companies now (partners: the partner-fit question, for shortlist carriers).
 * { action: 'recruit', dots: [{dot, state}] }: add shortlist carriers to the agent network's recruiting list.
 * { action: 'sync', state }: refresh one state from DOT data now.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);

    if (body.action === 'track') {
      const query = parseQuery((body.query && typeof body.query === 'object' ? body.query : {}) as Record<string, unknown>);
      const limit = Math.min(Math.max(Number(body.limit) || 300, 1), 300);
      const result = await searchRegistry({ ...query, page: 1, pageSize: limit }, null, { all: true });
      let rows = result.all || [];
      const filtered = await applyEnrichmentFilters(rows, (body.query || {}) as Record<string, unknown>);
      if (filtered) rows = filtered;
      if (result.mode === 'national') {
        // National lists hold summary rows; fetch full records state by state.
        const byState = new Map<string, Mover[]>();
        for (const m of rows.slice(0, limit)) byState.set(m.state, [...(byState.get(m.state) || []), m]);
        const full: Mover[] = [];
        for (const [state, list] of byState) { const all = new Map((await loadState(state)).map(m => [m.dot, m])); for (const m of list) full.push(all.get(m.dot) || m); }
        rows = full;
      }
      return NextResponse.json(await trackMovers(rows.slice(0, limit), body.tier === 'legend' ? 'legend' : 'challenger', user.uid));
    }

    if (body.action === 'legends') {
      const result = await searchRegistry({ sort: 'size', page: 1, pageSize: 400 }, null, { all: true });
      const enr = await enrichmentFor((result.all || []).map(m => m.dot));
      const ok = (result.all || []).filter(m => { const k = enr.get(m.dot)?.kind; return !k || k === 'local_mover' || k === 'van_line'; }).slice(0, 100);
      const full: Mover[] = [];
      const byState = new Map<string, Mover[]>();
      for (const m of ok) byState.set(m.state, [...(byState.get(m.state) || []), m]);
      for (const [state, list] of byState) { const all = new Map((await loadState(state)).map(m => [m.dot, m])); for (const m of list) full.push(all.get(m.dot) || m); }
      return NextResponse.json(await trackMovers(full, 'legend', user.uid));
    }

    if (body.action === 'classify' && body.partners === true) {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      const rows = await shortlistRows(body.dots, 40);
      let classified = 0; const failed: string[] = [];
      await Promise.all(rows.map(async m => { try { await classifyPartnerAndSave(m); classified++; } catch { failed.push(m.dot); } }));
      return NextResponse.json({ classified, failed });
    }

    if (body.action === 'recruit') {
      const rows = await shortlistRows(body.dots, 100);
      const db = adminDb(), now = FieldValue.serverTimestamp();
      const existing = new Set((await db.collection('agentProspects').select('dot').get()).docs.map(d => String(d.data().dot || '')));
      const enr = await enrichmentFor(rows.map(m => m.dot));
      const batch = db.batch();
      let added = 0;
      for (const m of rows) {
        if (existing.has(m.dot)) continue;
        const fit = enr.get(m.dot)?.partnerFit;
        batch.set(db.collection('agentProspects').doc(), {
          company: (m.dba || m.name).slice(0, 160), city: m.city, region: REGION_BY_CODE.has(`US-${m.state}`) ? `US-${m.state}` : REGION_BY_CODE.has(`CA-${m.state}`) ? `CA-${m.state}` : '', contact: '', phone: m.phone, email: m.email, website: m.site,
          notes: `Partner shortlist (DOT census): USDOT ${m.dot}${m.mc ? `, ${m.mc}` : ''}; ${servicesLabel(m)}; ${m.units} trucks, ${m.drivers} drivers, ${yearsInBusiness(m)} years; partner fit ${m.partnerScore ?? '—'}/100${fit ? ` (AI: ${fit.replace(/_/g, ' ')})` : ''}.`,
          dot: m.dot, source: 'partner-shortlist', stage: 'prospect', nextFollowUp: '', createdBy: user.uid, createdAt: now, updatedAt: now,
        });
        added++;
      }
      if (added) await batch.commit();
      // Skipped: already on the recruiting list, or not on the shortlist (movers are recruited from the mover list).
      return NextResponse.json({ added, skipped: Math.min(Array.isArray(body.dots) ? body.dots.length : 0, 100) - added });
    }

    if (body.action === 'classify') {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      const list = (Array.isArray(body.dots) ? body.dots : []).slice(0, 40) as { dot: string; state: string }[];
      const byState = new Map<string, string[]>();
      for (const d of list) if (typeof d?.dot === 'string' && REGISTRY_AREAS.includes(d?.state)) byState.set(d.state, [...(byState.get(d.state) || []), d.dot]);
      let classified = 0; const failed: string[] = [];
      for (const [state, dots] of byState) {
        const rows = new Map((await loadState(state)).map(m => [m.dot, m]));
        await Promise.all(dots.map(async dot => { const m = rows.get(dot); if (!m) return; try { await classifyAndSave(m); classified++; } catch { failed.push(dot); } }));
      }
      return NextResponse.json({ classified, failed });
    }

    if (body.action === 'sync') {
      const state = String(body.state || '').toUpperCase();
      if (!REGISTRY_AREAS.includes(state)) throw new HttpError(400, 'Choose a state.');
      const r = await syncState(state);
      await stateSummaries(true);
      return NextResponse.json(r);
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}

/** Shortlist carriers by DOT number, from each state's partner file. */
async function shortlistRows(dots: unknown, limit: number): Promise<Mover[]> {
  const list = (Array.isArray(dots) ? dots : []).slice(0, limit) as { dot: string; state: string }[];
  const byState = new Map<string, Set<string>>();
  for (const d of list) if (typeof d?.dot === 'string' && /^\d{1,9}$/.test(d.dot) && REGISTRY_AREAS.includes(d?.state)) byState.set(d.state, (byState.get(d.state) || new Set()).add(d.dot));
  const out: Mover[] = [];
  for (const [state, want] of byState) for (const t of await loadPartners(state)) if (want.has(t[0])) out.push(tupleToMover(t, state, null));
  return out;
}
