import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { runRegistrySync } from '@/lib/server/registry-sync';

/** Every 15 minutes (Cloud Scheduler): refresh the stalest states from free DOT data. */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/registry-sync'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runRegistrySync(45_000);
  return NextResponse.json(result, { status: result.failed.length && !result.done.length ? 502 : 200 });
}
