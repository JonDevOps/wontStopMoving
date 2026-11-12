import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { ourMetrics, refreshStandings } from '@/lib/server/competitors';
import { cleanMetrics, cleanSocials, normalizeWebsite, parseCompetitorList, scoreboard, type Tier } from '@/lib/competitors';
import { fetchPublicPageText } from '@/lib/server/safe-fetch';

/** Competitor tracker: the list with scoreboards, and every change to it. */
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const tierOf = (v: unknown): Tier => (v === 'legend' ? 'legend' : 'challenger');
const NOTE_KEYS = ['pricing', 'promotions', 'ads', 'social', 'other'] as const;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [usMetrics, snap, usSettings] = await Promise.all([ourMetrics(), db.collection('competitors').limit(2000).get(), db.doc('competitorSettings/us').get()]);
    const us = { ...usMetrics, socials: usSettings.data()?.socials || {}, hasAuthority: usSettings.data()?.hasAuthority === true };
    const competitors = snap.docs.map(d => {
      const c = d.data();
      return {
        id: d.id, name: c.name, website: c.website || '', location: c.location || '', dot: c.dot || null, state: c.state || null, registry: c.registry || null, phone: c.phone || '', tier: tierOf(c.tier), status: c.status === 'passed' ? 'passed' : 'tracking',
        metrics: c.metrics || {}, socials: c.socials || {}, notes: c.notes || {}, intel: c.intel || null, analysis: c.analysis || null, actions: Array.isArray(c.actions) ? c.actions : [],
        score: scoreboard(usMetrics.metrics, c.metrics || {}), passedAt: iso(c.passedAt), passedHow: c.passedHow || null, analyzedAt: iso(c.analyzedAt), createdAt: iso(c.createdAt),
      };
    });
    let progress;
    if (new URL(req.url).searchParams.get('history') === '1') {
      const hist = await db.collection('competitorSettings/us/history').orderBy('day', 'desc').limit(400).get();
      progress = {
        history: hist.docs.map(d => ({ day: d.data().day, metrics: d.data().metrics || {}, passed: d.data().passed || 0, actionsDone: d.data().actionsDone || 0 })).reverse(),
        passes: competitors.filter(c => c.status === 'passed' && c.passedAt).map(c => ({ id: c.id, name: c.name, tier: c.tier, at: c.passedAt, how: c.passedHow })),
        actions: competitors.flatMap(c => c.actions.filter((a: any) => a.done && a.doneAt).map((a: any) => ({ competitor: c.name, text: a.text, area: a.area, impact: a.impact, at: a.doneAt }))),
      };
    }
    return NextResponse.json({ us, competitors, progress }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb(), col = db.collection('competitors');
    const now = FieldValue.serverTimestamp();
    const doc = async (id: unknown) => {
      if (!isId(id)) throw new HttpError(400, 'Choose a competitor.');
      const ref = col.doc(id), snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, 'Competitor not found.');
      return { ref, data: snap.data()! };
    };

    switch (body.action) {
      case 'add': {
        const name = str(body.name, 120);
        if (name.length < 2) throw new HttpError(400, 'Enter the company name.');
        const ref = await col.add({ name, nameLower: name.toLowerCase(), website: normalizeWebsite(str(body.website, 300)), location: str(body.location, 120), tier: tierOf(body.tier), status: 'tracking', metrics: cleanMetrics(body.metrics), notes: {}, actions: [], createdBy: user.uid, createdAt: now, updatedAt: now });
        return NextResponse.json({ id: ref.id }, { status: 201 });
      }
      case 'import': {
        const rows = parseCompetitorList(str(body.text, 100_000));
        if (!rows.length) throw new HttpError(400, 'Paste at least one company, one per line.');
        const existing = new Set((await col.select('nameLower').get()).docs.map(d => d.data().nameLower));
        const fresh = rows.filter(r => !existing.has(r.name.toLowerCase()));
        for (let i = 0; i < fresh.length; i += 400) {
          const batch = db.batch();
          for (const r of fresh.slice(i, i + 400)) batch.set(col.doc(), { ...r, nameLower: r.name.toLowerCase(), tier: tierOf(body.tier), status: 'tracking', metrics: {}, notes: {}, actions: [], createdBy: user.uid, createdAt: now, updatedAt: now });
          await batch.commit();
        }
        return NextResponse.json({ added: fresh.length, skipped: rows.length - fresh.length });
      }
      case 'update': {
        const { ref } = await doc(body.id);
        const patch: Record<string, unknown> = { updatedAt: now };
        if (typeof body.name === 'string') { const name = str(body.name, 120); if (name.length < 2) throw new HttpError(400, 'Enter the company name.'); patch.name = name; patch.nameLower = name.toLowerCase(); }
        if (typeof body.website === 'string') patch.website = normalizeWebsite(str(body.website, 300));
        if (typeof body.location === 'string') patch.location = str(body.location, 120);
        if (body.tier !== undefined) patch.tier = tierOf(body.tier);
        if (body.metrics !== undefined) patch.metrics = cleanMetrics(body.metrics);
        if (body.socials !== undefined) patch.socials = cleanSocials(body.socials);
        if (body.notes && typeof body.notes === 'object') for (const k of NOTE_KEYS) { const v = (body.notes as Record<string, unknown>)[k]; if (typeof v === 'string') patch[`notes.${k}`] = str(v, 4000); }
        await ref.update(patch);
        return NextResponse.json({ ok: true });
      }
      case 'pass': {
        const { ref } = await doc(body.id);
        await ref.update(body.passed === false ? { status: 'tracking', passedAt: FieldValue.delete(), passedHow: FieldValue.delete(), updatedAt: now } : { status: 'passed', passedAt: now, passedHow: 'manual', updatedAt: now });
        return NextResponse.json({ ok: true });
      }
      case 'delete': {
        const { ref } = await doc(body.id);
        await ref.delete();
        return NextResponse.json({ ok: true });
      }
      case 'toggle-action': case 'add-action': case 'remove-action': {
        const { ref } = await doc(body.id);
        await db.runTransaction(async tx => {
          const current = (await tx.get(ref)).data()?.actions;
          const actions: any[] = Array.isArray(current) ? current : [];
          let next = actions;
          if (body.action === 'add-action') {
            const text = str(body.text, 400);
            if (text.length < 3) throw new HttpError(400, 'Describe the action.');
            next = [...actions, { id: randomUUID().slice(0, 8), text, impact: ['high', 'medium', 'low'].includes(body.impact as string) ? body.impact : 'medium', area: 'Custom', done: false }].slice(-40);
          } else if (body.action === 'toggle-action') {
            next = actions.map(a => (a.id === body.actionId ? { ...a, done: body.done === true, doneAt: body.done === true ? new Date().toISOString() : null } : a));
          } else next = actions.filter(a => a.id !== body.actionId);
          tx.update(ref, { actions: next, updatedAt: now });
        });
        return NextResponse.json({ ok: true });
      }
      case 'us': {
        // Merge so other settings (authority, social links) aren't wiped.
        await db.doc('competitorSettings/us').set({
          ...(body.metrics !== undefined ? { metrics: cleanMetrics(body.metrics) } : {}),
          ...(typeof body.hasAuthority === 'boolean' ? { hasAuthority: body.hasAuthority } : {}),
          ...(body.socials !== undefined ? { socials: cleanSocials(body.socials) } : {}),
          updatedBy: user.uid, updatedAt: now,
        }, { merge: true });
        return NextResponse.json({ ok: true });
      }
      case 'find-socials': {
        const { ref, data } = await doc(body.id);
        if (!data.website) throw new HttpError(400, 'Add their website first.');
        let found: Record<string, string> = {};
        try { found = cleanSocials((await fetchPublicPageText(data.website, 2000)).social); }
        catch (error) { throw new HttpError(502, error instanceof Error ? `Couldn’t read their website: ${error.message}` : 'Couldn’t read their website.'); }
        const merged = { ...found, ...(data.socials || {}) };
        await ref.update({ socials: merged, socialsCheckedAt: now, updatedAt: now });
        return NextResponse.json({ found: Object.keys(found).length, socials: merged });
      }
      case 'refresh-standings':
        return NextResponse.json(await refreshStandings());
      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (error) { return errorResponse(error); }
}
