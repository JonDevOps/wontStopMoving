import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { runQuoteFollowUps } from '@/lib/server/followups';
import { runMoveReminders } from '@/lib/server/move-reminders';
import { runDemandMonitor } from '@/lib/server/demand-monitor';
import { runInsuranceReminders } from '@/lib/server/mover-profile';

/**
 * Called hourly by Google Cloud Scheduler: sends due quote follow-ups and
 * day-before move reminders, and checks the demand-monitor feeds. One part
 * failing doesn't stop the others.
 */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/quote-followups'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [followUps, reminders, demand, insurance] = await Promise.allSettled([runQuoteFollowUps(), runMoveReminders(), runDemandMonitor(), runInsuranceReminders()]);
  const result = {
    followUps: followUps.status === 'fulfilled' ? followUps.value : { error: String(followUps.reason) },
    moveReminders: reminders.status === 'fulfilled' ? reminders.value : { error: String(reminders.reason) },
    demand: demand.status === 'fulfilled' ? demand.value : { error: String(demand.reason) },
    insurance: insurance.status === 'fulfilled' ? insurance.value : { error: String(insurance.reason) },
  };
  const failed = followUps.status === 'rejected' && reminders.status === 'rejected';
  return NextResponse.json(result, { status: failed ? 502 : 200 });
}
