import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';
import { MOVER_REGIONS } from '@/lib/mover-regions';

export function moverRegion(code: string) {
  const name = MOVER_REGIONS[code];
  const actual = name && ALL_LOCATIONS.find(location => slugify(location) === slugify(name) || (code === 'nl' && /newfoundland/i.test(location)) || (code === 'nt' && /northwest territor/i.test(location)) || (code === 'yt' && /yukon/i.test(location)));
  return actual ? { code, name: actual, slug: slugify(actual), cities: CITIES_BY_STATE[slugify(actual)] || [] } : null;
}
export function moverCity(code: string, citySlug: string) {
  const region = moverRegion(code);
  const city = region?.cities.find(name => slugify(name) === citySlug);
  return region && city ? { ...region, city, citySlug } : null;
}
