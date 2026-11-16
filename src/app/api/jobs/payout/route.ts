import { NextResponse } from 'next/server';
import { payoutCompletedJob } from '@/lib/server/jobs';
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe } from '@/lib/server/auth';
export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const { jobId } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, 'Choose a job.');
    requireStripe();
    return NextResponse.json(await payoutCompletedJob(jobId));
  } catch (error) { return errorResponse(error); }
}
