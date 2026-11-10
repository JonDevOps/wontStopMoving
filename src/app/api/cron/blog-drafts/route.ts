import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { draftNextPosts } from '@/lib/server/blog';
import { enqueueEmail } from '@/lib/server/notifications';

/**
 * Called weekly by Google Cloud Scheduler. Drafts the next topics in the
 * rotation and emails the admin that they're ready. Nothing is published
 * until an admin schedules it.
 *
 * No shared secret: Cloud Scheduler signs each call with a Google ID token
 * for CRON_SERVICE_ACCOUNT, and we accept only that account and audience.
 */
const AUDIENCE = process.env.CRON_AUDIENCE || 'https://wontstopmoving.com/api/cron/blog-drafts';
const verifier = new OAuth2Client();

async function authorized(req: Request) {
  const allowed = process.env.CRON_SERVICE_ACCOUNT;
  const token = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/)?.[1];
  if (!allowed || !token) return false;
  try {
    const payload = (await verifier.verifyIdToken({ idToken: token, audience: AUDIENCE })).getPayload();
    return payload?.email === allowed && payload.email_verified === true;
  } catch { return false; }
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
