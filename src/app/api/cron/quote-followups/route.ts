import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { runQuoteFollowUps } from '@/lib/server/followups';

/** Called hourly by Google Cloud Scheduler to send due quote follow-ups. */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/quote-followups'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runQuoteFollowUps();
  return NextResponse.json(result, { status: result.failed && !result.sent ? 502 : 200 });
}
