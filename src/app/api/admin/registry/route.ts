import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { ourFleet, searchRegistry, stateSummaries, type RegistryQuery } from '@/lib/server/registry-query';
import { classifyAndSave, enrichmentFor } from '@/lib/server/registry-enrich';
import { syncState } from '@/lib/server/registry-sync';
import { trackedByDot, trackMovers } from '@/lib/server/registry-track';
import { loadState } from '@/lib/server/registry-store';
import { jevConfigured } from '@/lib/server/jev';
import { moversCsv, REGION_PRESETS, US_STATES, yearsInBusiness, type Mover, type SortKey } from '@/lib/registry';

/**
 * The national mover registry (free FMCSA data): search, map points, our
 * rank, CSV export, and bulk actions (track as competitors, classify, refresh).
 */
export const maxDuration = 60;
const SORTS: SortKey[] = ['size', 'units', 'drivers', 'miles', 'years', 'newest', 'name', 'distance'];
const n = (v: string | null) => (v === null || v === '' ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);

function parseQuery(p: URLSearchParams | Record<string, unknown>): RegistryQuery {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k] === undefined || p[k] === null ? null : String(p[k]));
  const states = (get('states') || '').toUpperCase().split(',').map(s => s.trim()).filter(s => US_STATES.includes(s));
  const [south, west, north, east] = ['south', 'west', 'north', 'east'].map(k => n(get(k)));
  const [nearLat, nearLng, nearMiles] = ['nearLat', 'nearLng', 'nearMiles'].map(k => n(get(k)));
  const region = get('region') || undefined;
  return {
    q: (get('q') || '').slice(0, 80) || undefined, states, region: region && REGION_PRESETS[region] ? region : undefined,
    city: (get('city') || '').slice(0, 60) || undefined, zip: /^\d{3,5}$/.test(get('zip') || '') ? get('zip')! : undefined,
    bbox: [south, west, north, east].every(v => v !== undefined) ? { south: south!, west: west!, north: north!, east: east! } : undefined,
    near: nearLat !== undefined && nearLng !== undefined ? { lat: nearLat, lng: nearLng, miles: Math.min(nearMiles || 25, 500) } : undefined,
    minUnits: n(get('minUnits')), maxUnits: n(get('maxUnits')), minDrivers: n(get('minDrivers')), minYears: n(get('minYears')),
    addedSince: /^\d+$/.test(get('newDays') || '') ? new Date(Date.now() - Math.min(Number(get('newDays')), 3650) * 86400000).toISOString().slice(0, 10) : undefined,
    interstate: get('interstate') === 'yes' || get('interstate') === 'no' ? (get('interstate') as 'yes' | 'no') : undefined,
    hhgAuth: get('hhg') === '1', likelyOnly: get('likely') !== '0', hasEmail: get('email') === '1', hasSite: get('site') === '1', noSite: get('site') === '0',
    org: (get('org') || '').slice(0, 30) || undefined,
    sort: SORTS.includes(get('sort') as SortKey) ? (get('sort') as SortKey) : 'size',
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
    return { ...m, years: yearsInBusiness(m), kind: e?.kind || null, kindConfidence: e?.kindConfidence ?? null, sosActive: e?.sos?.best ? e.sos.best.active : null, sosChecked: !!e?.sos?.checkedAt, competitorId: tracked.get(m.dot) || null };
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
      return new NextResponse(moversCsv(rows.slice(0, 20000)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="movers-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' } });
    }
    const summaries = await stateSummaries();
    return NextResponse.json({
      mode: result.mode, nationalComplete: result.nationalComplete ?? null, total, rows: await decorate(rows), rank: result.rank, points: result.points, totals: result.totals, updatedAt: result.updatedAt,
      synced: summaries.length, jev: jevConfigured(),
      stateStats: params.get('stats') === '1' ? summaries.map(s => ({ state: s.state, count: s.count, likely: s.likely, units: s.units, center: s.center, updatedAt: s.updatedAt })) : undefined,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/**
 * { action: 'track', query, limit, tier }: add the top N of a search to the competitor tracker.
 * { action: 'legends' }: the national top 100 likely movers (brokers and non-movers excluded once Jev has sorted them) become legends.
 * { action: 'classify', dots: [{dot, state}] }: Jev-sort up to 40 companies now.
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

    if (body.action === 'classify') {
      if (!jevConfigured()) throw new HttpError(503, 'Jev isn’t configured yet (TYPESAFE_API_KEY).');
      const list = (Array.isArray(body.dots) ? body.dots : []).slice(0, 40) as { dot: string; state: string }[];
      const byState = new Map<string, string[]>();
      for (const d of list) if (typeof d?.dot === 'string' && US_STATES.includes(d?.state)) byState.set(d.state, [...(byState.get(d.state) || []), d.dot]);
      let classified = 0; const failed: string[] = [];
      for (const [state, dots] of byState) {
        const rows = new Map((await loadState(state)).map(m => [m.dot, m]));
        await Promise.all(dots.map(async dot => { const m = rows.get(dot); if (!m) return; try { await classifyAndSave(m); classified++; } catch { failed.push(dot); } }));
      }
      return NextResponse.json({ classified, failed });
    }

    if (body.action === 'sync') {
      const state = String(body.state || '').toUpperCase();
      if (!US_STATES.includes(state)) throw new HttpError(400, 'Choose a state.');
      const r = await syncState(state);
      await stateSummaries(true);
      return NextResponse.json(r);
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
