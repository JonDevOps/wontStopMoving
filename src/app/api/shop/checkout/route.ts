import { NextResponse } from 'next/server';
import { errorResponse, readJson, requireRole, siteOrigin } from '@/lib/server/auth';
import { createShopCheckout } from '@/lib/server/shop';

/** Start a Stripe Checkout for a supplies order (signed-in customers). Prices are set on the server. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const body = await readJson(req);
    const result = await createShopCheckout({ uid: user.uid, email: user.email || '', origin: siteOrigin(req), items: body.items, fulfillment: body.fulfillment, jobId: body.jobId, notes: body.notes });
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
