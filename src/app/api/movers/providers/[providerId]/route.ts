import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { isId } from '@/lib/server/auth';
import { validProviderPricing } from '@/lib/mover-pricing';

export async function GET(_req: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  if (!isId(providerId)) return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
  try {
    const p = (await adminDb().doc(`providers/${providerId}`).get()).data();
    if (!p || p.status !== 'approved' || !validProviderPricing(p.hourlyRate,p.minimumHours) || p.stripeOnboardingComplete !== true || !String(p.stripeAccountId || '').startsWith('acct_')) return NextResponse.json({ error: 'Provider unavailable for booking.' }, { status: 404 });
    return NextResponse.json({ id: providerId, businessName: String(p.businessName || 'Moving provider'), hourlyRate: p.hourlyRate, minimumHours: p.minimumHours }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Provider lookup is temporarily unavailable.' }, { status: 503 }); }
}
