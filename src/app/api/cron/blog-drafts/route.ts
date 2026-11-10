import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { draftNextPosts } from '@/lib/server/blog';
import { enqueueEmail } from '@/lib/server/notifications';

/**
 * Called weekly by Google Cloud Scheduler with `Authorization: Bearer
 * <CRON_SECRET>`. Drafts the next topics in the rotation and emails the admin
 * that they're ready. Nothing is published until an admin schedules it.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const given = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (secret.length < 32 || !given) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const count = Math.min(Math.max(Number(new URL(req.url).searchParams.get('count')) || 3, 1), 5);
  const result = await draftNextPosts(count);
  if (result.drafted.length) {
    const week = new Date().toISOString().slice(0, 10);
    try {
      await enqueueEmail(`blog-drafts:${week}`, {
        category: 'blog', referenceId: week,
        to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
        subject: `${result.drafted.length} blog draft${result.drafted.length === 1 ? '' : 's'} ready for review`,
        text: `New AI drafts are waiting. Nothing is published until you review and schedule it.\n\n${result.drafted.map(d => `• ${d.title} (${d.category})`).join('\n')}${result.failed.length ? `\n\nCouldn't draft: ${result.failed.join(', ')}` : ''}\n\nReview them:\nhttps://wontstopmoving.com/dashboard/admin/blog\n\nWont Stop Moving`,
      });
    } catch (error) { console.error('Blog draft email failed', error); }
  }
  return NextResponse.json(result, { status: result.drafted.length || !result.failed.length ? 200 : 502 });
}
