import { NextResponse } from 'next/server';
import { createTipCheckout } from '@/lib/server/move-benefits';
import { errorResponse, HttpError, isId, readJson, requireRole, siteOrigin } from '@/lib/server/auth';
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const body = await readJson(req);
    if (!isId(body.jobId)) throw new HttpError(400, 'Choose a move.');
    return NextResponse.json(await createTipCheckout(user.uid, user.email, body.jobId, body.amountCents, siteOrigin(req)));
  } catch (error) { return errorResponse(error); }
}
