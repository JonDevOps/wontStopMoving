import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { cleanFeeds, demandSettings, runDemandMonitor } from '@/lib/server/demand-monitor';

const STATUSES = ['new', 'contacted', 'won', 'ignored'] as const;

/** Settings, feed health and found posts (best first). */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const settings = await demandSettings();
    const snap = await adminDb().collection('demandSignals').orderBy('foundAt', 'desc').limit(300).get();
    const signals = snap.docs.map(d => { const s = d.data(); return { id: d.id, title: s.title, link: s.link, text: s.text, published: s.published, phrases: s.phrases, places: s.places, score: s.score, status: s.status, feed: s.feed, foundAt: s.foundAt?.toDate?.().toISOString() || null }; });
    const feeds = settings.feeds.map(f => ({ url: f, status: settings.feedStatus[createHash('sha1').update(f).digest('hex').slice(0, 12)] || 'not checked yet' }));
    return NextResponse.json({ feeds, places: settings.places, signals }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** action 'settings' (feeds, places), 'status' (one post), or 'run' (check feeds now). */
export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb();
    if (body.action === 'settings') {
      const places = (Array.isArray(body.places) ? body.places : String(body.places || '').split(',')).map((p: unknown) => String(p).trim().slice(0, 60)).filter(Boolean).slice(0, 50);
      const feeds = cleanFeeds(body.feeds);
      await db.doc('settings/demandMonitor').set({ feeds, places, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ feeds, places });
    }
    if (body.action === 'run') return NextResponse.json(await runDemandMonitor());
    if (body.action === 'status') {
      if (typeof body.id !== 'string' || !/^[a-f0-9]{24}$/.test(body.id)) throw new HttpError(400, 'Choose a post.');
      if (!(STATUSES as readonly unknown[]).includes(body.status)) throw new HttpError(400, 'Choose a status.');
      const ref = db.doc(`demandSignals/${body.id}`);
      if (!(await ref.get()).exists) throw new HttpError(404, 'Post not found.');
      await ref.update({ status: body.status, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
