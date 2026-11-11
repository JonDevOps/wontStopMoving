import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { runQuoteFollowUps } from '@/lib/server/followups';
import { runMoveReminders } from '@/lib/server/move-reminders';

/**
 * Called hourly by Google Cloud Scheduler: sends due quote follow-ups and
 * day-before move reminders. One part failing doesn't stop the other.
 */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/quote-followups'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [followUps, reminders] = await Promise.allSettled([runQuoteFollowUps(), runMoveReminders()]);
  const result = {
    followUps: followUps.status === 'fulfilled' ? followUps.value : { error: String(followUps.reason) },
    moveReminders: reminders.status === 'fulfilled' ? reminders.value : { error: String(reminders.reason) },
  };
  const failed = followUps.status === 'rejected' && reminders.status === 'rejected';
  return NextResponse.json(result, { status: failed ? 502 : 200 });
}
