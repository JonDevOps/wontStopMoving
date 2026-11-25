import { NextResponse } from 'next/server';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { zipLookup } from '@/lib/server/geo';
import { lookupZip } from '@/lib/server/zip';
import { allow, clientIp } from '@/lib/server/rate-limit';
import { slugify } from '@/lib/location-data';

/**
 * Public provider search by ZIP code or coordinates (#141): approved providers
 * within the radius, plus any who list the ZIP's city as a service area.
 * Featured providers come first, then the nearest (#147).
 */
export async function GET(req: Request) {
  if (!allow(`providers-near:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 });
  const p = new URL(req.url).searchParams;
  const miles = Math.min(Math.max(Number(p.get('miles')) || 50, 5), 200);
  let center: [number, number] | null = null, cityKey: string | null = null, place: string | null = null;
  const zip = (p.get('zip') || '').trim();
  if (zip) {
    const point = zipLookup(zip), info = lookupZip(zip);
    if (!point || !info) return NextResponse.json({ error: 'We couldn’t find that ZIP code.' }, { status: 404 });
    center = point; cityKey = `${info.stateCode.toLowerCase()}/${slugify(info.city)}`; place = `${info.city}, ${info.stateCode}`;
  } else {
    const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: 'Enter a ZIP code.' }, { status: 400 });
    center = [lat, lng];
  }
  try {
    const db = adminDb(), approved = db.collection('providers').where('status', '==', 'approved');
    const queries = geohashQueryBounds(center, miles * 1609.344).map(([start, end]) => approved.orderBy('geohash').startAt(start).endAt(end).get());
    if (cityKey) queries.push(approved.where('serviceAreaCities', 'array-contains', cityKey).get());
    const docs = new Map<string, QueryDocumentSnapshot>();
    for (const snap of await Promise.all(queries)) for (const d of snap.docs) docs.set(d.id, d);
    const providers = [...docs.values()].flatMap(d => {
      const x = d.data(), loc = x.location as { lat?: number; lng?: number } | undefined;
      const distance = typeof loc?.lat === 'number' && typeof loc?.lng === 'number' ? distanceBetween(center!, [loc.lat, loc.lng]) * 0.621371 : null;
      const servesCity = !!cityKey && Array.isArray(x.serviceAreaCities) && x.serviceAreaCities.includes(cityKey);
      if (!servesCity && (distance === null || distance > miles)) return [];
      return [{
        id: d.id, businessName: String(x.businessName || 'Moving provider').slice(0, 160), bio: String(x.bio || '').slice(0, 500),
        services: Array.isArray(x.services) ? x.services.filter((s: unknown) => typeof s === 'string').slice(0, 12) : [],
        rating: typeof x.rating === 'number' ? x.rating : 0, reviewCount: typeof x.reviewCount === 'number' ? x.reviewCount : 0,
        hourlyRate: typeof x.hourlyRate === 'number' ? x.hourlyRate : null, verified: x.onboarding?.insuranceUploaded === true,
        featured: x.featured === true, distance: distance === null ? null : Math.round(distance * 10) / 10,
      }];
    }).sort((a, b) => Number(b.featured) - Number(a.featured) || (a.distance ?? 9999) - (b.distance ?? 9999));
    return NextResponse.json({ providers, place, miles }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Provider search is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
