import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { processEmailQueue } from '@/lib/server/notifications';

export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/email-outbox'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await processEmailQueue(10));
}
