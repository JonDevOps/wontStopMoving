import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';

/** Display name for a state/province slug we serve, or null. */
export function stateNameFor(stateSlug: string): string | null {
  if (!CITIES_BY_STATE[stateSlug]) return null;
  return ALL_LOCATIONS.find((loc) => slugify(loc) === stateSlug) || null;
}

/** { state, city } display names for a city page we serve, or null. */
export function cityFor(stateSlug: string, citySlug: string): { state: string; city: string } | null {
  const state = stateNameFor(stateSlug);
  const city = state ? CITIES_BY_STATE[stateSlug].find((c) => slugify(c) === citySlug) : undefined;
  return state && city ? { state, city } : null;
}
