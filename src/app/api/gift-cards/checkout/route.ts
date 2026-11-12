import { NextResponse } from 'next/server';
import { errorResponse, readJson, requireRole, siteOrigin } from '@/lib/server/auth';
import { createGiftCardCheckout } from '@/lib/server/rewards';

/** Start a Stripe Checkout for a gift card (signed-in buyers). */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const body = await readJson(req);
    const result = await createGiftCardCheckout({
      uid: user.uid, email: user.email || '', origin: siteOrigin(req), amount: body.amount,
      recipientName: body.recipientName, recipientEmail: body.recipientEmail, message: body.message, fromName: body.fromName,
    });
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
