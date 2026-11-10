import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { draftNextPosts, nextPublishSlot, readTime } from '@/lib/server/blog';
import { BLOG_TOPICS } from '@/lib/blog-topics';

const iso = (value: any) => value?.toDate?.().toISOString() || null;
const isSlug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value);
const text = (value: unknown, label: string, min: number, max: number) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
};

/** Drafts, scheduled and rejected posts for the admin Blog page. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const snap = await adminDb().collection('blogPosts').orderBy('createdAt', 'desc').limit(150).get();
    const posts = snap.docs.map(doc => {
      const d = doc.data();
      return { slug: doc.id, title: d.title, excerpt: d.excerpt, content: d.content, category: d.category, topicId: d.topicId, status: d.status, source: d.source, readTime: readTime(d.content || ''), publishAt: iso(d.publishAt), createdAt: iso(d.createdAt) };
    });
    return NextResponse.json({ posts, nextSlot: (await nextPublishSlot()).toISOString(), topics: BLOG_TOPICS.map(t => ({ id: t.id, category: t.category })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/**
 * Admin actions: generate (one AI draft), save (edit), schedule (approve with
 * a publish time; a past time publishes now), unschedule (back to draft) and
 * reject.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    if (body.action === 'generate') {
      if (body.topicId !== undefined && !BLOG_TOPICS.some(t => t.id === body.topicId)) throw new HttpError(400, 'Choose a topic.');
      const result = await draftNextPosts(1, typeof body.topicId === 'string' ? body.topicId : undefined);
      if (!result.drafted.length) throw new HttpError(502, 'The AI could not write a draft right now. Try again in a minute.');
      return NextResponse.json(result);
    }
    if (!isSlug(body.slug)) throw new HttpError(400, 'Choose a post.');
    const db = adminDb(), ref = db.doc(`blogPosts/${body.slug}`);
    const update = await db.runTransaction(async tx => {
      const post = (await tx.get(ref)).data();
      if (!post) throw new HttpError(404, 'That post no longer exists.');
      const by = { updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() };
      switch (body.action) {
        case 'save': {
          if (post.status === 'rejected') throw new HttpError(409, 'Rejected posts can’t be edited.');
          const fields = { title: text(body.title, 'Title', 5, 120), excerpt: text(body.excerpt, 'Summary', 20, 300), content: text(body.content, 'Article', 200, 20000), category: text(body.category, 'Category', 2, 60) };
          tx.update(ref, { ...fields, ...by });
          return 'saved';
        }
        case 'schedule': {
          if (post.status === 'rejected') throw new HttpError(409, 'Rejected posts can’t be scheduled.');
          const when = typeof body.publishAt === 'string' ? Date.parse(body.publishAt) : NaN;
          if (Number.isNaN(when) || when > Date.now() + 366 * 86400000) throw new HttpError(400, 'Choose a publish date within the next year.');
          tx.update(ref, { status: 'scheduled', publishAt: Timestamp.fromMillis(when), approvedBy: user.uid, ...by });
          return when <= Date.now() ? 'published' : 'scheduled';
        }
        case 'unschedule':
          if (post.status !== 'scheduled') throw new HttpError(409, 'Only scheduled posts can be moved back to drafts.');
          tx.update(ref, { status: 'draft', publishAt: null, ...by });
          return 'draft';
        case 'reject':
          if (post.status !== 'draft') throw new HttpError(409, 'Only drafts can be rejected.');
          tx.update(ref, { status: 'rejected', ...by });
          return 'rejected';
        default:
          throw new HttpError(400, 'Choose an action.');
      }
    });
    return NextResponse.json({ status: update });
  } catch (error) { return errorResponse(error); }
}
