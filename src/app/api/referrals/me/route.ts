import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, requireRole } from '@/lib/server/auth';
import { getOrCreateReferralCode, referralLink, REFERRAL_REWARD_USD } from '@/lib/server/referrals';

/** The signed-in customer's referral link and the rewards they've earned. */
export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    const code = await getOrCreateReferralCode(user.uid);
    const snap = await adminDb().collection('referrals').where('referrerUid', '==', user.uid).limit(100).get();
    const referrals = snap.docs.map(d => { const r = d.data(); return { status: r.status, amountUsd: r.amountUsd, createdAt: r.createdAt?.toDate?.().toISOString() || null }; });
    return NextResponse.json({
      code, link: referralLink(code), rewardUsd: REFERRAL_REWARD_USD, referrals,
      earnedUsd: referrals.reduce((n, r) => n + (Number(r.amountUsd) || 0), 0),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
