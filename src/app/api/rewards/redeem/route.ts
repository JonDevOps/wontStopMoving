import { NextResponse } from 'next/server';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { allow } from '@/lib/server/rate-limit';
import { redeemGiftCard } from '@/lib/server/rewards';

/** Redeem a gift card code into move credit. Rate-limited per account to stop code guessing. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    if (!allow(`giftcard-redeem:${user.uid}`, 8, 60 * 60 * 1000)) throw new HttpError(429, 'Too many tries. Please wait an hour or contact support.');
    const body = await readJson(req);
    const result = await redeemGiftCard(user.uid, body.code);
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
