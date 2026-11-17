import zipCities from '@/data/zip-cities.json';
import zipCenters from '@/data/zip-latlng.json';
import canadianCenters from '@/data/canada-city-centers.json';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bsaint\b/g, 'st').replace(/[^a-z0-9]/g, '');
const centers = new Map<string, [number, number]>();
for (const [zip, label] of Object.entries(zipCities)) {
  const [name, region] = label.split('|');
  const point = (zipCenters as unknown as Record<string, [number, number]>)[zip];
  const key = `${region.toLowerCase()}/${normalize(name)}`;
  if (point && !centers.has(key)) centers.set(key, point);
}
export function moverCityCenter(region: string, city: string, citySlug: string): [number, number] | null {
  return (canadianCenters as unknown as Record<string, [number, number]>)[`${region}/${citySlug}`] || centers.get(`${region}/${normalize(city)}`) || null;
}
export function providerDistance(center: [number, number] | null, location: unknown) {
  const point = location as {lat?: number; lng?: number} | undefined;
  return center && typeof point?.lat === 'number' && typeof point.lng === 'number' && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? distanceBetween(center, [point.lat, point.lng]) * 0.621371 : null;
}

export function providerServesCity(provider: Record<string, unknown>, region: string, city: string, center: [number, number] | null) {
  const distance = providerDistance(center, provider.location);
  return (Array.isArray(provider.serviceAreaCities) && provider.serviceAreaCities.includes(`${region}/${city}`)) || (distance !== null && distance <= 50);
}

/** Index-backed city coverage + nearby geohash ranges; exact distance removes range false positives. */
export async function cityProviderCandidates(db: Firestore, region: string, city: string, center: [number, number] | null) {
  const approved = db.collection('providers').where('status', '==', 'approved');
  const queries = [approved.where('serviceAreaCities', 'array-contains', `${region}/${city}`).get()];
  if (center) for (const [start, end] of geohashQueryBounds(center, 50 * 1609.344)) queries.push(approved.orderBy('geohash').startAt(start).endAt(end).get());
  const snapshots = await Promise.all(queries), docs = new Map<string, QueryDocumentSnapshot>();
  for (const snapshot of snapshots) for (const doc of snapshot.docs) docs.set(doc.id, doc);
  return [...docs.values()].filter(doc => providerServesCity(doc.data(), region, city, center));
}
