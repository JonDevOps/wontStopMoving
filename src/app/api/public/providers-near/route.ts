import { NextResponse } from 'next/server';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { geocodeSearch } from '@/lib/server/geocode';
import { rankInput } from '@/lib/server/provider-stats';
import { rankProviders } from '@/lib/provider-rank';
import { allow, clientIp } from '@/lib/server/rate-limit';

/**
 * Public provider search (#141): by address, city, ZIP code (`q`) or the
 * browser's coordinates. Returns approved providers within the radius plus any
 * who list that city, ranked with featured providers first (#147).
 */
export async function GET(req: Request) {
  if (!allow(`providers-near:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 });
  const p = new URL(req.url).searchParams;
  const miles = Math.min(Math.max(Number(p.get('miles')) || 50, 5), 200);
  let center: [number, number] | null = null, cityKey: string | null = null, place: string | null = null;
  const q = (p.get('q') || p.get('zip') || '').trim();
  if (q) {
    const found = await geocodeSearch(q);
    if (!found) return NextResponse.json({ error: 'We couldn’t find that address. Try adding the city and state, or just a ZIP code.' }, { status: 404 });
    center = found.center; cityKey = found.cityKey; place = found.label;
  } else {
    const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: 'Enter your address or ZIP code.' }, { status: 400 });
    center = [lat, lng];
  }
  try {
    const db = adminDb(), approved = db.collection('providers').where('status', '==', 'approved');
    const queries = geohashQueryBounds(center, miles * 1609.344).map(([start, end]) => approved.orderBy('geohash').startAt(start).endAt(end).get());
    if (cityKey) queries.push(approved.where('serviceAreaCities', 'array-contains', cityKey).get());
    const docs = new Map<string, QueryDocumentSnapshot>();
    for (const snap of await Promise.all(queries)) for (const d of snap.docs) docs.set(d.id, d);
    const matches = [...docs.values()].flatMap(d => {
      const x = d.data(), loc = x.location as { lat?: number; lng?: number } | undefined;
      const distance = typeof loc?.lat === 'number' && typeof loc?.lng === 'number' ? distanceBetween(center!, [loc.lat, loc.lng]) * 0.621371 : null;
      const servesCity = !!cityKey && Array.isArray(x.serviceAreaCities) && x.serviceAreaCities.includes(cityKey);
      return servesCity || (distance !== null && distance <= miles) ? [{ d, x, distance }] : [];
    });
    const ranked = rankProviders(await Promise.all(matches.map(async ({ d, x, distance }) => ({
      id: d.id, rank: await rankInput(db, d.id, x),
      businessName: String(x.businessName || 'Moving provider').slice(0, 160), bio: String(x.bio || '').slice(0, 500),
      services: Array.isArray(x.services) ? x.services.filter((s: unknown) => typeof s === 'string').slice(0, 12) : [],
      rating: typeof x.rating === 'number' ? x.rating : 0, reviewCount: typeof x.reviewCount === 'number' ? x.reviewCount : 0,
      hourlyRate: typeof x.hourlyRate === 'number' ? x.hourlyRate : null, verified: x.onboarding?.insuranceUploaded === true,
      distance: distance === null ? null : Math.round(distance * 10) / 10,
    }))));
    const providers = ranked.map(({ rank, ...r }) => ({ ...r, jobsCompleted: rank.jobsCompleted }));
    return NextResponse.json({ providers, place, miles }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Provider search is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
