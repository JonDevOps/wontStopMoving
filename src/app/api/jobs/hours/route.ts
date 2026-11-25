import { NextResponse } from 'next/server';
import { requestExtraHours, respondExtraHours } from '@/lib/server/extra-hours';
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe } from '@/lib/server/auth';

/**
 * Extra hours on a marketplace job (#153).
 *  - provider/admin: { action: 'request', jobId, hours, reason }
 *  - customer: { action: 'accept' | 'decline', jobId } (accept charges the saved card)
 */
export async function POST(req: Request) {
  try {
    const { user, role } = await requireRole(req, ['provider', 'admin', 'customer']);
    const body = await readJson(req);
    if (!isId(body.jobId)) throw new HttpError(400, 'Choose a job.');
    if (body.action === 'request') {
      if (role === 'customer') throw new HttpError(403, 'Only the crew can request more hours.');
      return NextResponse.json({ request: await requestExtraHours({ jobId: body.jobId, uid: user.uid, isAdmin: role === 'admin', hours: body.hours, reason: body.reason }) });
    }
    if (body.action === 'accept' || body.action === 'decline') {
      if (role !== 'customer') throw new HttpError(403, 'Only the customer can answer this request.');
      if (body.action === 'accept') requireStripe();
      return NextResponse.json(await respondExtraHours({ jobId: body.jobId, uid: user.uid, accept: body.action === 'accept' }));
    }
    throw new HttpError(400, 'Choose an action.');
  } catch (error) { return errorResponse(error); }
}
