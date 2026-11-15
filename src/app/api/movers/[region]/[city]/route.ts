import { NextResponse } from 'next/server';
import { moverCity } from '@/lib/server/mover-locations';
import { adminDb } from '@/lib/server/firebase-admin';
import { validProviderPricing } from '@/lib/mover-pricing';
import zipCities from '@/data/zip-cities.json';
import zipCenters from '@/data/zip-latlng.json';
import { distanceBetween } from 'geofire-common';

const normalize = (name: string) => name.toLowerCase().replace(/\bsaint\b/g, 'st').replace(/[^a-z0-9]/g, '');
export async function GET(req: Request, { params }: { params: Promise<{ region: string; city: string }> }) {
  const { region, city } = await params;
  const place = moverCity(region, city);
  if (!place) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
  const point = Object.entries(zipCities).find(([zip, label]) => { const [name, code] = label.split('|'); return code.toLowerCase() === region && normalize(name) === normalize(place.city) && !!(zipCenters as Record<string, number[]>)[zip]; });
  const center = point ? (zipCenters as unknown as Record<string, [number, number]>)[point[0]] : null;
  const date = new URL(req.url).searchParams.get('date') || '';
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date)) return NextResponse.json({ error: 'Choose a valid service date.' }, { status: 400 });
  try {
    const snapshot = await adminDb().collection('providers').where('status', '==', 'approved').get();
    const completed = await adminDb().collection('jobs').where('status', '==', 'completed').select('providerIds').get();
    const counts = new Map<string,number>();
    for (const job of completed.docs) for (const id of new Set<string>(Array.isArray(job.data().providerIds) ? job.data().providerIds.filter((id: unknown) => typeof id === 'string') : [])) counts.set(id,(counts.get(id) || 0)+1);
    const providers = snapshot.docs.flatMap(doc => {
      const p = doc.data();
      if (date && ((Array.isArray(p.unavailableDates) && p.unavailableDates.includes(date)) || (Array.isArray(p.availableDays) && !p.availableDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())))) return [];
      if (!validProviderPricing(p.hourlyRate, p.minimumHours) || p.stripeOnboardingComplete !== true || typeof p.stripeAccountId !== 'string' || !p.stripeAccountId.startsWith('acct_')) return [];
      let distance: number | null = null;
      if (center && typeof p.location?.lat === 'number' && typeof p.location?.lng === 'number' && Math.abs(p.location.lat) <= 90 && Math.abs(p.location.lng) <= 180) distance = distanceBetween(center, [p.location.lat, p.location.lng]) * 0.621371;
      const explicitlyCovered = Array.isArray(p.serviceAreaCities) && p.serviceAreaCities.includes(`${region}/${city}`);
      if (!explicitlyCovered && (distance === null || distance > 50)) return [];
      return [{ id: doc.id, name: String(p.businessName || 'Moving provider').slice(0,160), bio: String(p.bio || '').slice(0,1000), hourlyRate: p.hourlyRate, minimumHours: p.minimumHours, services: Array.isArray(p.services) ? p.services.filter((item: unknown) => typeof item === 'string') : [], rating: typeof p.rating === 'number' ? p.rating : 0, reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : 0, jobsCompleted: counts.get(doc.id) || 0, distance: distance === null ? null : Math.round(distance) }];
    });
    return NextResponse.json({ providers, coverageLocated: !!center, city: place.city, region: place.name }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Provider search is temporarily unavailable. Please try again.' }, { status: 503 }); }
}
