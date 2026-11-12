import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { radarSettings, watchedStates } from '@/lib/server/market';
import { loadNational } from '@/lib/server/registry-store';
import { OUTREACH_SEED, isOutreachKind, isOutreachStatus, outreachId } from '@/lib/outreach';

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const url = (v: unknown) => { const s = text(v, 500); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; };

/** The tracker (starting list merged with saved progress) and moving brokers to contact. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const saved = new Map((await db.collection('outreach').limit(1000).get()).docs.map(d => [d.id, d.data()]));
    const seeded = new Set(OUTREACH_SEED.map(s => s.id));
    const view = (id: string, d: FirebaseFirestore.DocumentData | undefined) => ({
      status: isOutreachStatus(d?.status) ? d!.status : 'todo', listingUrl: d?.listingUrl || '', notes: d?.notes || '',
      updatedAt: d?.updatedAt?.toDate?.().toISOString() || null,
    });
    const items = [
      ...OUTREACH_SEED.map(s => ({ ...s, custom: false, ...view(s.id, saved.get(s.id)) })),
      ...[...saved].filter(([id]) => !seeded.has(id)).map(([id, d]) => ({ id, name: d.name, kind: d.kind, url: d.url || '', why: d.why || '', phone: d.phone || '', custom: true, ...view(id, d) })),
    ];
    // Moving brokers in the watched states (they book moves they don't do), biggest first.
    const states = watchedStates(await radarSettings());
    const brokers = await loadNational(states).then(({ rows }) => rows
      .filter(m => m.broker && !saved.has(`broker-${m.dot}`))
      .sort((a, b) => b.units - a.units).slice(0, 40)
      .map(m => ({ dot: m.dot, name: m.dba || m.name, city: m.city, state: m.state, phone: m.phone, site: m.site, units: m.units, hauls: m.authActive })))
      .catch(() => []);
    return NextResponse.json({ items, brokers, states }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Update an entry's status/notes, or add a custom entry or a broker. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb();
    if (body.action === 'add') {
      const name = text(body.name, 120);
      if (name.length < 2) throw new HttpError(400, 'Enter a name.');
      const id = body.dot && /^\d{1,10}$/.test(String(body.dot)) ? `broker-${body.dot}` : `custom-${outreachId(name)}`;
      if (id === 'custom-') throw new HttpError(400, 'Enter a name.');
      await db.doc(`outreach/${id}`).set({
        name, kind: isOutreachKind(body.kind) ? body.kind : 'other', url: url(body.url), why: text(body.why, 300), phone: text(body.phone, 40),
        status: 'todo', createdBy: user.uid, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ id });
    }
    const id = text(body.id, 80);
    if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new HttpError(400, 'Choose an entry.');
    const known = OUTREACH_SEED.some(s => s.id === id) || (await db.doc(`outreach/${id}`).get()).exists;
    if (!known) throw new HttpError(404, 'Entry not found.');
    if (body.action === 'remove') {
      if (OUTREACH_SEED.some(s => s.id === id)) throw new HttpError(400, 'Built-in entries can be skipped, not removed.');
      await db.doc(`outreach/${id}`).delete();
      return NextResponse.json({ removed: true });
    }
    if (!isOutreachStatus(body.status)) throw new HttpError(400, 'Choose a status.');
    await db.doc(`outreach/${id}`).set({
      status: body.status, listingUrl: url(body.listingUrl), notes: text(body.notes, 1000), updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
