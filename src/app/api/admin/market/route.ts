import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { listEvents, type MarketEvent } from '@/lib/server/market-events';
import { acquisitionTargets, expansion, inWatch, radarSettings, watchedStates } from '@/lib/server/market';
import { areaResults, ASSETS, campaignZips, STAGES, writeScripts, type AssetKey, type TakeoverStage } from '@/lib/server/takeover';
import { priceSummary, runPriceIndex } from '@/lib/server/price-index';
import { routingSettings } from '@/lib/server/routing';
import { sendDailyRadar } from '@/lib/server/radar';
import { trackMovers } from '@/lib/server/registry-track';
import { findMover } from '@/lib/server/registry-query';
import { REGION_PRESETS, REGISTRY_AREAS } from '@/lib/registry';

/**
 * Market Radar: closures (with the takeover playbook), new/grew/shrank,
 * where to expand, companies to buy, the price index, and settings.
 */
export const maxDuration = 60;
const iso = (v: any) => v?.toDate?.().toISOString() || null;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const p = new URL(req.url).searchParams;
    const view = p.get('view') || 'closures';
    const settings = await radarSettings();
    const scope = p.get('scope') || 'watched'; // 'watched' areas, or a state code
    const states = REGISTRY_AREAS.includes(scope) ? [scope] : watchedStates(settings);
    const keep = (e: { state: string; county: string }) => (REGISTRY_AREAS.includes(scope) ? e.state === scope : inWatch(settings, e));
    const days = Math.min(Math.max(Number(p.get('days')) || 365, 1), 730);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const routing = await routingSettings();

    if (view === 'settings') return NextResponse.json({ settings, routing, regions: Object.fromEntries(Object.entries(REGION_PRESETS).map(([k, r]) => [k, r.label])) });

    if (view === 'closures') {
      const events = (await listEvents({ sinceDay: since, types: ['closed'], limit: 3000 })).filter(keep);
      const tk = await adminDb().collection('takeovers').get();
      const stage = new Map(tk.docs.map(d => [d.id, d.data()]));
      const rows = events.map(e => ({ ...e, stage: (stage.get(e.dot)?.stage || 'new') as TakeoverStage, owner: stage.get(e.dot)?.owner || null }))
        .sort((a, b) => (b.effectiveDate || b.day).localeCompare(a.effectiveDate || a.day));
      return NextResponse.json({ events: rows, stages: STAGES, settings }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (view === 'takeover') {
      const dot = p.get('dot') || '';
      const snap = await adminDb().doc(`registryEvents/closed-${dot}`).get();
      if (!snap.exists) throw new HttpError(404, 'Closure not found.');
      const e = snap.data() as MarketEvent;
      const zips = campaignZips(e);
      const [t, results] = await Promise.all([adminDb().doc(`takeovers/${dot}`).get(), areaResults(zips, e.effectiveDate || e.day)]);
      const td = t.data() || {};
      return NextResponse.json({
        event: e, zips, results, stages: STAGES, assets: ASSETS,
        takeover: { stage: td.stage || 'new', notes: td.notes || '', assets: td.assets || {}, scripts: td.scripts || null, scriptsAt: iso(td.scriptsAt), updatedAt: iso(td.updatedAt), log: td.log || [] },
        links: {
          safer: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${e.dot}`,
          google: `https://www.google.com/search?q=${encodeURIComponent(`${e.dba || e.name} ${e.city} ${e.state}`)}`,
          site: e.site || null, landing: 'https://wontstopmoving.com/mover-closed',
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (view === 'changes') {
      const events = (await listEvents({ sinceDay: since, types: ['new', 'grew', 'shrank'], limit: 3000 })).filter(keep);
      return NextResponse.json({ events }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (view === 'expansion') {
      const rows = await expansion(p.get('scope') === 'national' ? undefined : REGISTRY_AREAS.includes(scope) ? [scope] : undefined);
      return NextResponse.json({ counties: rows.slice(0, 300) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (view === 'acquisitions') {
      const rows = await acquisitionTargets(states);
      return NextResponse.json({ targets: rows.filter(r => REGISTRY_AREAS.includes(scope) || inWatch(settings, r) || settings.states.includes(r.state)).slice(0, 150) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (view === 'prices') return NextResponse.json(await priceSummary(states), { headers: { 'Cache-Control': 'private, no-store' } });
    throw new HttpError(400, 'Unknown view.');
  } catch (error) { return errorResponse(error); }
}

/**
 * POST actions: settings; takeover-update { dot, stage?, notes?, assets? };
 * takeover-scripts { dot }; track { dot, state, tier } (acquisition targets);
 * price-refresh; radar-test.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb();

    if (body.action === 'settings') {
      const regions = Array.isArray(body.regions) ? body.regions.filter((r: unknown) => typeof r === 'string' && REGION_PRESETS[r]) : undefined;
      const states = Array.isArray(body.states) ? body.states.filter((s: unknown) => typeof s === 'string' && REGISTRY_AREAS.includes(s)) : undefined;
      const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(body.email.trim()) ? body.email.trim() : undefined;
      if (regions || states || email) await db.doc('marketSettings/radar').set({ ...(regions ? { regions } : {}), ...(states ? { states } : {}), ...(email ? { email } : {}), updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (typeof body.autoAssign === 'boolean' || typeof body.maxMiles === 'number') {
        await db.doc('marketSettings/routing').set({ ...(typeof body.autoAssign === 'boolean' ? { autoAssign: body.autoAssign } : {}), ...(typeof body.maxMiles === 'number' && body.maxMiles > 0 && body.maxMiles <= 500 ? { maxMiles: body.maxMiles } : {}), updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'takeover-update' || body.action === 'takeover-scripts') {
      const dot = String(body.dot || '');
      const ev = await db.doc(`registryEvents/closed-${dot}`).get();
      if (!/^\d{1,9}$/.test(dot) || !ev.exists) throw new HttpError(404, 'Closure not found.');
      if (body.action === 'takeover-scripts') {
        try { return NextResponse.json({ scripts: await writeScripts(ev.data() as MarketEvent) }); }
        catch (error) { console.error('Takeover scripts failed', dot, error); throw new HttpError(502, 'The AI couldn’t write the scripts. Try again in a minute.'); }
      }
      const patch: Record<string, unknown> = { dot, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() };
      const changes: string[] = [];
      if (typeof body.stage === 'string') { if (!(body.stage in STAGES)) throw new HttpError(400, 'Choose a stage.'); patch.stage = body.stage; changes.push(`Stage: ${STAGES[body.stage as TakeoverStage]}`); }
      if (typeof body.notes === 'string') patch.notes = body.notes.trim().slice(0, 5000);
      if (body.assets && typeof body.assets === 'object') {
        // set() with merge needs a nested object (dotted keys would be literal field names).
        const assets: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(body.assets as Record<string, unknown>)) if (k in ASSETS) { assets[k] = v === true; changes.push(`${ASSETS[k as AssetKey]}: ${v === true ? 'yes' : 'no'}`); }
        if (Object.keys(assets).length) patch.assets = assets;
      }
      if (changes.length) patch.log = FieldValue.arrayUnion({ at: new Date().toISOString(), by: user.email || user.uid, text: changes.join('; ') });
      await db.doc(`takeovers/${dot}`).set(patch, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'track') {
      const m = await findMover(String(body.dot || ''), String(body.state || ''));
      if (!m) throw new HttpError(404, 'Company not found.');
      return NextResponse.json(await trackMovers([m], body.tier === 'legend' ? 'legend' : 'challenger', user.uid));
    }

    if (body.action === 'price-refresh') return NextResponse.json(await runPriceIndex(Date.now() + 50_000, 4));
    if (body.action === 'radar-test') return NextResponse.json(await sendDailyRadar(true));
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
