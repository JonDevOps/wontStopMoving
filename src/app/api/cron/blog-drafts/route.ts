import { NextResponse } from 'next/server';
import { draftNextPosts } from '@/lib/server/blog';
import { enqueueEmail } from '@/lib/server/notifications';
import { isSchedulerRequest } from '@/lib/server/cron-auth';

/**
 * Called weekly by Google Cloud Scheduler (signed with a Google ID token; see
 * cron-auth). Drafts the next topics in the rotation and emails the admin
 * that they're ready. Nothing is published until an admin schedules it.
 */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/blog-drafts'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
