import { NextResponse } from 'next/server';
import { isSchedulerRequest } from '@/lib/server/cron-auth';
import { runEnrichment } from '@/lib/server/registry-enrich';

/** Every 15 minutes (Cloud Scheduler): Jev sorts the biggest unclassified movers. */
export async function POST(req: Request) {
  if (!(await isSchedulerRequest(req, '/api/cron/registry-enrich'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runEnrichment(45_000));
}
