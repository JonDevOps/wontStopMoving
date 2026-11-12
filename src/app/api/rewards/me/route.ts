import { NextResponse } from 'next/server';
import { errorResponse, requireRole } from '@/lib/server/auth';
import { getWallet } from '@/lib/server/rewards';
import { MAX_CREDIT_SHARE, MOVE_CREDIT_USD } from '@/lib/rewards';

/** The signed-in customer's move-credit balance and history. */
export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const wallet = await getWallet(user.uid);
    return NextResponse.json({ ...wallet, moveCreditUsd: MOVE_CREDIT_USD, maxSharePct: Math.round(MAX_CREDIT_SHARE * 100) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
