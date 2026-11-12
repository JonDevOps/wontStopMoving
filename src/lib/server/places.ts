import { adminDb } from './firebase-admin';
import { placeMatches } from '@/lib/web-presence';
import type { Mover } from '@/lib/registry';

/**
 * Google Places (New), only when you ask about one company.
 *
 * Google's terms: place IDs may be stored indefinitely; ratings, reviews,
 * phone, website and the rest may not be stored or turned into our own
 * content. So we save only the place ID (registryEnrichment/{dot}.placeId)
 * and show everything else live, with Google Maps attribution.
 *
 * Cost control: every billed call reserves one unit from a monthly budget in
 * apiUsage/googlePlaces first, below Google's free monthly caps:
 *   - details (Enterprise fields: rating, reviews count, website, phone, hours): PLACES_MONTHLY_CAP, default 900 (Google: 1,000 free/month)
 *   - matching a company to its place (Pro fields: name, address): PLACES_MATCH_MONTHLY_CAP, default 4,000 (Google: 5,000 free/month)
 * Key: GOOGLE_CLOUD_API_KEY (Places API (New) enabled; also used for YouTube).
 */
const API = 'https://places.googleapis.com/v1';
const DETAIL_FIELDS = ['id', 'displayName', 'formattedAddress', 'rating', 'userRatingCount', 'websiteUri', 'nationalPhoneNumber', 'businessStatus', 'googleMapsUri', 'regularOpeningHours.weekdayDescriptions', 'primaryTypeDisplayName'];
const MATCH_FIELDS = ['id', 'displayName', 'formattedAddress', 'businessStatus'];

export const placesKey = () => process.env.GOOGLE_CLOUD_API_KEY || '';
export const placesConfigured = () => !!placesKey();
const caps = () => ({ details: Number(process.env.PLACES_MONTHLY_CAP || 900), match: Number(process.env.PLACES_MATCH_MONTHLY_CAP || 4000) });
const month = (d = new Date()) => d.toISOString().slice(0, 7);

export type PlacesUsage = { month: string; details: number; match: number; detailsCap: number; matchCap: number };

export async function placesUsage(): Promise<PlacesUsage> {
  const d = (await adminDb().doc('apiUsage/googlePlaces').get()).data();
  const same = d?.month === month();
  return { month: month(), details: same ? d!.details || 0 : 0, match: same ? d!.match || 0 : 0, detailsCap: caps().details, matchCap: caps().match };
}

/** Takes one call from this month's budget, or throws when it's used up. */
async function reserve(kind: 'details' | 'match') {
  const ref = adminDb().doc('apiUsage/googlePlaces');
  await adminDb().runTransaction(async tx => {
    const d = (await tx.get(ref)).data();
    const cur = d?.month === month() ? d : { month: month(), details: 0, match: 0 };
    if ((cur[kind] || 0) >= caps()[kind]) throw new PlacesBudgetError(kind === 'details' ? `This month’s ${caps().details} Google lookups are used up (it resets on the 1st).` : `This month’s ${caps().match} Google matches are used up (it resets on the 1st).`);
    tx.set(ref, { ...cur, [kind]: (cur[kind] || 0) + 1, updatedAt: new Date() });
  });
}
export class PlacesBudgetError extends Error {}

type Place = { id: string; displayName?: { text: string }; formattedAddress?: string; rating?: number; userRatingCount?: number; websiteUri?: string; nationalPhoneNumber?: string; businessStatus?: string; googleMapsUri?: string; regularOpeningHours?: { weekdayDescriptions?: string[] }; primaryTypeDisplayName?: { text: string } };

async function call(path: string, fields: string[], body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(12_000),
    headers: { 'X-Goog-Api-Key': placesKey(), 'X-Goog-FieldMask': fields.join(','), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google Places answered ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

function search(m: Mover, fields: string[]) {
  return call('/places:searchText', fields.map(f => `places.${f}`), {
    textQuery: `${m.dba || m.name} ${m.street ? `${m.street}, ` : ''}${m.city}, ${m.state}`,
    maxResultCount: 5,
    ...(m.lat !== null && m.lng !== null ? { locationBias: { circle: { center: { latitude: m.lat, longitude: m.lng }, radius: 30000 } } } : {}),
  }).then(r => (r.places || []) as Place[]);
}

async function savePlaceId(m: Mover, placeId: string | null) {
  await adminDb().doc(`registryEnrichment/${m.dot}`).set({ dot: m.dot, state: m.state, placeId, placeCheckedAt: new Date() }, { merge: true });
}

export type GoogleInfo = {
  placeId: string; name: string; address: string; rating: number | null; reviews: number | null; website: string | null; phone: string | null;
  status: string | null; mapsUrl: string | null; hours: string[]; type: string | null;
};
const toInfo = (p: Place): GoogleInfo => ({
  placeId: p.id, name: p.displayName?.text || '', address: p.formattedAddress || '', rating: p.rating ?? null, reviews: p.userRatingCount ?? null,
  website: p.websiteUri || null, phone: p.nationalPhoneNumber || null, status: p.businessStatus || null, mapsUrl: p.googleMapsUri || null,
  hours: p.regularOpeningHours?.weekdayDescriptions || [], type: p.primaryTypeDisplayName?.text || null,
});

/**
 * Live Google Business info for one company (one billed call). Never stored,
 * except the place ID so later lookups go straight to the right listing.
 */
export async function googleInfo(m: Mover): Promise<{ info: GoogleInfo | null; usage: PlacesUsage }> {
  if (!placesConfigured()) throw new Error('Google Places isn’t set up yet (GOOGLE_CLOUD_API_KEY).');
  const known = (await adminDb().doc(`registryEnrichment/${m.dot}`).get()).data()?.placeId as string | undefined;
  await reserve('details');
  let info: GoogleInfo | null = null;
  if (known) {
    info = toInfo(await call(`/places/${encodeURIComponent(known)}`, DETAIL_FIELDS));
  } else {
    const best = (await search(m, DETAIL_FIELDS)).find(p => placeMatches(m, p));
    info = best ? toInfo(best) : null;
    await savePlaceId(m, info?.placeId || null);
  }
  return { info, usage: await placesUsage() };
}

/** Finds and saves a company's place ID only (name and address checked, nothing else kept). */
export async function matchPlace(m: Mover): Promise<string | null> {
  if (!placesConfigured()) throw new Error('Google Places isn’t set up yet (GOOGLE_CLOUD_API_KEY).');
  await reserve('match');
  const best = (await search(m, MATCH_FIELDS)).find(p => placeMatches(m, p));
  await savePlaceId(m, best?.id || null);
  return best?.id || null;
}
