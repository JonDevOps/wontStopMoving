import zipCities from '@/data/zip-cities.json';
import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';

/**
 * US ZIP code lookup from USPS ZIP Locale Detail data (issue #17), stored as
 * `{"75201": "Dallas|TX"}`. Says whether we serve the state and city, and
 * links to the matching location page.
 */
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District Of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', VI: 'U.S. Virgin Islands', GU: 'Guam', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

export type ZipInfo = {
  zip: string; city: string; stateCode: string; state: string;
  servedState: boolean; servedCity: boolean; href: string | null;
};

const ZIPS = zipCities as Record<string, string>;
/** "Saint Louis", "St. Louis" and "st-louis" all compare equal. */
const cityKey = (city: string) => city.toLowerCase().replace(/\bsaint\b/g, 'st').replace(/\bsainte\b/g, 'ste').replace(/[^a-z0-9]/g, '');

export function lookupZip(raw: string): ZipInfo | null {
  const zip = (raw || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip) || !ZIPS[zip]) return null;
  const [city, stateCode] = ZIPS[zip].split('|');
  const state = STATE_NAMES[stateCode] || stateCode;
  const servedState = ALL_LOCATIONS.includes(state);
  const stateSlug = slugify(state);
  const listed = servedState ? (CITIES_BY_STATE[stateSlug] || []).find(c => cityKey(c) === cityKey(city)) : undefined;
  return {
    zip, city, stateCode, state, servedState, servedCity: !!listed,
    href: !servedState ? null : listed ? `/locations/${stateSlug}/${slugify(listed)}` : `/locations/${stateSlug}`,
  };
}
