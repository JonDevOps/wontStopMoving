import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Type } from '@google/genai';
import { adminDb } from './firebase-admin';
import { generateJson } from './gemini';
import { BLOG_POSTS, type BlogPost } from '@/app/blog/posts';
import { BLOG_TOPICS, topicById, type BlogTopic } from '@/lib/blog-topics';

/**
 * Scheduled blog posts. Drafts live in `blogPosts/{slug}` (server-only; the
 * Firestore rules deny all client access). A post appears on the public blog
 * only once an admin has scheduled it and its publish time has passed.
 *
 *   draft     – written (by AI or an admin), waiting for review
 *   scheduled – approved; public from `publishAt`
 *   rejected  – kept so its topic and title aren't drafted again
 */
export type BlogStatus = 'draft' | 'scheduled' | 'rejected';
export type StoredBlogPost = {
  slug: string; title: string; excerpt: string; content: string; category: string;
  topicId: string; image: string; status: BlogStatus; source: 'ai' | 'admin';
  publishAt: Timestamp | null; createdAt: Timestamp | null;
};

const collection = () => adminDb().collection('blogPosts');

export const readTime = (content: string) => `${Math.max(2, Math.round(content.split(/\s+/).length / 220))} min read`;
const displayDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

function toPublic(p: StoredBlogPost): BlogPost {
  return { slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content, category: p.category, date: displayDate(p.publishAt!.toDate()), readTime: readTime(p.content), image: p.image };
}

/**
 * Scheduled posts whose time has come. Returns none during `next build`
 * (no database there; pages revalidate at runtime) or if Firestore fails, so
 * the static posts always render.
 */
export async function publishedDbPosts(): Promise<BlogPost[]> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return [];
  try {
    const snap = await collection().where('status', '==', 'scheduled').where('publishAt', '<=', Timestamp.now()).get();
    return snap.docs.map(d => toPublic(d.data() as StoredBlogPost));
  } catch (error) {
    console.error('Could not load scheduled blog posts', error);
    return [];
  }
}

/** Every public post, newest first. Database posts win if a slug repeats. */
export async function allPublicPosts(): Promise<BlogPost[]> {
  const db = await publishedDbPosts();
  const taken = new Set(db.map(p => p.slug));
  return [...db, ...BLOG_POSTS.filter(p => !taken.has(p.slug))]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function findPublicPost(slug: string): Promise<BlogPost | null> {
  const fromStatic = BLOG_POSTS.find(p => p.slug === slug);
  if (process.env.NEXT_PHASE !== 'phase-production-build' && /^[a-z0-9-]{1,100}$/.test(slug)) {
    try {
      const doc = (await collection().doc(slug).get()).data() as StoredBlogPost | undefined;
      if (doc?.status === 'scheduled' && doc.publishAt && doc.publishAt.toMillis() <= Date.now()) return toPublic(doc);
    } catch (error) { console.error('Could not load blog post', slug, error); }
  }
  return fromStatic || null;
}

export function slugify(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'post';
}

async function uniqueSlug(title: string) {
  const base = slugify(title);
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!BLOG_POSTS.some(p => p.slug === slug) && !(await collection().doc(slug).get()).exists) return slug;
  }
  throw new Error('Could not find a free slug.');
}

/** The next `count` topics, least recently drafted first. */
async function nextTopics(count: number): Promise<BlogTopic[]> {
  const recent = await collection().orderBy('createdAt', 'desc').limit(BLOG_TOPICS.length * 3).get();
  const lastUsed = new Map<string, number>();
  for (const d of recent.docs) {
    const { topicId, createdAt } = d.data();
    if (topicId && !lastUsed.has(topicId)) lastUsed.set(topicId, createdAt?.toMillis?.() || 0);
  }
  return [...BLOG_TOPICS]
    .sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1) || BLOG_TOPICS.indexOf(a) - BLOG_TOPICS.indexOf(b))
    .slice(0, count);
}

const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Specific, useful headline, under 80 characters, no clickbait.' },
    excerpt: { type: Type.STRING, description: 'One or two sentences (under 220 characters) saying what the reader will learn.' },
    content: { type: Type.STRING, description: 'The article as plain-text paragraphs separated by a blank line. 600 to 900 words. No Markdown symbols.' },
  },
  required: ['title', 'excerpt', 'content'],
};

/** Has Gemini write one draft for `topic`, avoiding titles already used. */
export async function draftPost(topic: BlogTopic): Promise<StoredBlogPost> {
  const recent = await collection().orderBy('createdAt', 'desc').limit(60).get();
  const usedTitles = [...BLOG_POSTS.map(p => p.title), ...recent.docs.map(d => d.data().title as string)].slice(0, 220);
  const prompt = [
    'You write the blog for Wont Stop Moving, an online marketplace where customers book vetted, independent moving professionals in the US, Puerto Rico and Canada.',
    `Write one genuinely useful article for the "${topic.category}" section. Focus: ${topic.focus}`,
    `Related services on the site: ${topic.services.join(', ')}.`,
    '',
    'Rules:',
    '- Give specific, practical, accurate advice a reader can act on: steps, checklists in sentence form, and tradeoffs.',
    '- Do not invent statistics, prices, studies, laws, customer stories, testimonials or quotes. If something varies by location or provider, say so.',
    '- Do not make claims about Wont Stop Moving beyond this: customers get an instant quote, book online, and the mover is paid only after the customer confirms the job is done with a 6-digit release code. Never say "escrow".',
    '- Mention a relevant service at most once, naturally, near the end.',
    '- Plain, friendly language. No hype, no filler, no headings, no Markdown.',
    '- Pick a subject that is clearly different from these existing titles:',
    ...usedTitles.map(t => `  • ${t}`),
  ].join('\n');
  const out = await generateJson<{ title: string; excerpt: string; content: string }>([{ text: prompt }], DRAFT_SCHEMA);
  const title = out.title.trim().slice(0, 120), excerpt = out.excerpt.trim().slice(0, 300), content = out.content.trim().slice(0, 20000);
  if (!title || !excerpt || content.split(/\s+/).length < 200) throw new Error('Gemini returned an incomplete draft.');
  const slug = await uniqueSlug(title);
  const post: StoredBlogPost = { slug, title, excerpt, content, category: topic.category, topicId: topic.id, image: topic.images[Math.floor(Math.random() * topic.images.length)], status: 'draft', source: 'ai', publishAt: null, createdAt: null };
  await collection().doc(slug).create({ ...post, createdAt: FieldValue.serverTimestamp() });
  return post;
}

/**
 * Drafts the next `count` topics in parallel (so a run stays within the
 * server's request time limit). One failure doesn't stop the others.
 */
export async function draftNextPosts(count: number, topicId?: string) {
  const topics = topicId ? [topicById(topicId)].filter((t): t is BlogTopic => !!t) : await nextTopics(count);
  const results = await Promise.allSettled(topics.map(draftPost));
  const drafted: { slug: string; title: string; category: string }[] = [], failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') drafted.push({ slug: r.value.slug, title: r.value.title, category: r.value.category });
    else { console.error('Blog draft failed', topics[i].id, r.reason); failed.push(topics[i].category); }
  });
  return { drafted, failed };
}

/**
 * The next free publishing slot: Monday, Wednesday or Friday at 9:00 a.m.
 * US Eastern (14:00 UTC), at least a day out and not already taken.
 */
export async function nextPublishSlot(): Promise<Date> {
  const scheduled = await collection().where('status', '==', 'scheduled').where('publishAt', '>', Timestamp.now()).get();
  const taken = new Set(scheduled.docs.map(d => (d.data().publishAt as Timestamp).toDate().toISOString().slice(0, 10)));
  const day = new Date(Date.now() + 86400000);
  day.setUTCHours(14, 0, 0, 0);
  for (let i = 0; i < 120; i++, day.setUTCDate(day.getUTCDate() + 1)) {
    if ([1, 3, 5].includes(day.getUTCDay()) && !taken.has(day.toISOString().slice(0, 10))) return new Date(day);
  }
  return day;
}
