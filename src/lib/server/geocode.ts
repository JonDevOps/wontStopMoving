import zipCities from '@/data/zip-cities.json';
import { zipLookup } from './geo';
import { slugify } from '@/lib/location-data';

/**
 * Turns whatever a customer types (full address, "City, ST", or a ZIP code)
 * into a point for provider search (#141). Order: exact street address via the
 * free US Census geocoder, then a ZIP in the text, then a city/state match.
 */
export type Place = { center: [number, number]; label: string; cityKey: string | null; precise: boolean };

const CITIES = new Map<string, string>(); // "san francisco|ca" -> first ZIP
for (const [zip, label] of Object.entries(zipCities as Record<string, string>)) {
  const [city, st] = label.split('|');
  const key = `${city.toLowerCase()}|${st.toLowerCase()}`;
  if (!CITIES.has(key)) CITIES.set(key, zip);
}
const cityKeyFor = (city: string, st: string) => `${st.toLowerCase()}/${slugify(city)}`;

function fromZip(zip: string): Place | null {
  const point = zipLookup(zip), label = (zipCities as Record<string, string>)[zip];
  if (!point || !label) return null;
  const [city, st] = label.split('|');
  return { center: point, label: `${city}, ${st} ${zip}`, cityKey: cityKeyFor(city, st), precise: false };
}

async function census(address: string): Promise<Place | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const match = (await res.json())?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;
    const c = match.addressComponents || {};
    return {
      center: [Number(match.coordinates.y), Number(match.coordinates.x)],
      label: String(match.matchedAddress || address).slice(0, 200),
      cityKey: c.city && c.state ? cityKeyFor(String(c.city), String(c.state)) : null,
      precise: true,
    };
  } catch { return null; }
}

export async function geocodeSearch(raw: string): Promise<Place | null> {
  const text = raw.trim().slice(0, 200);
  if (!text) return null;
  if (/^\d{5}$/.test(text)) return fromZip(text);
  // A street number means a real address: try for an exact point first.
  if (/\d/.test(text.split(',')[0] || '')) {
    const exact = await census(text);
    if (exact) return exact;
  }
  const zip = text.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  if (zip) { const z = fromZip(zip); if (z) return z; }
  // "City, ST" or "City ST" (last two letters are the state).
  const m = text.replace(/\s+/g, ' ').match(/([A-Za-z .'-]+?)[, ]+([A-Za-z]{2})\b\.?\s*(?:usa?)?$/i);
  if (m) {
    const city = m[1].split(',').pop()!.trim().toLowerCase(), st = m[2].toLowerCase();
    const z = CITIES.get(`${city}|${st}`);
    if (z) { const p = fromZip(z)!; return { ...p, label: `${m[1].split(',').pop()!.trim()}, ${st.toUpperCase()}` }; }
  }
  return null;
}
