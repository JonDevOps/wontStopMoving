import { NextResponse } from 'next/server';
import { moverCity } from '@/lib/server/mover-locations';
import { adminDb } from '@/lib/server/firebase-admin';
import { validProviderPricing } from '@/lib/mover-pricing';
import { moverCityCenter, cityProviderCandidates, providerDistance } from '@/lib/server/mover-coverage';

export async function GET(req: Request, { params }: { params: Promise<{ region: string; city: string }> }) {
  const { region, city } = await params;
  const place = moverCity(region, city);
  if (!place) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
  const center = moverCityCenter(region, place.city, city);
  const date = new URL(req.url).searchParams.get('date') || '';
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date)) return NextResponse.json({ error: 'Choose a valid service date.' }, { status: 400 });
  try {
    const db = adminDb();
    const candidates = await cityProviderCandidates(db, region, city, center);
    const providers = candidates.flatMap(doc => {
      const p = doc.data();
      if (date && ((Array.isArray(p.unavailableDates) && p.unavailableDates.includes(date)) || (Array.isArray(p.availableDays) && !p.availableDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())))) return [];
      if (!validProviderPricing(p.hourlyRate, p.minimumHours) || p.stripeOnboardingComplete !== true || typeof p.stripeAccountId !== 'string' || !p.stripeAccountId.startsWith('acct_')) return [];
      const distance = providerDistance(center, p.location);
      return [{ id: doc.id, name: String(p.businessName || 'Moving provider').slice(0,160), bio: String(p.bio || '').slice(0,1000), hourlyRate: p.hourlyRate, minimumHours: p.minimumHours, services: Array.isArray(p.services) ? p.services.filter((item: unknown) => typeof item === 'string') : [], rating: typeof p.rating === 'number' ? p.rating : 0, reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : 0, jobsCompleted: null, distance: distance === null ? null : Math.round(distance) }];
    });
    await Promise.all(providers.map(async provider => {
      const count = await db.collection('jobs').where('providerIds', 'array-contains', provider.id).where('status', '==', 'completed').count().get();
      Object.assign(provider, { jobsCompleted: count.data().count });
    }));
    return NextResponse.json({ providers, coverageLocated: !!center, city: place.city, region: place.name }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Provider search is temporarily unavailable. Please try again.' }, { status: 503 }); }
}
