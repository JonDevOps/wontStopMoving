import zipLatLng from '@/data/zip-latlng.json';
import zipCounty from '@/data/zip-county.json';
import countyPopulation from '@/data/county-population.json';
import countyMoving from '@/data/county-moving-businesses.json';

/** Free Census Bureau geography: ZIP centers, ZIP → county, county population (2024). */
export const ZIPS = zipLatLng as unknown as Record<string, [number, number]>;
export const ZIP_COUNTY = zipCounty as unknown as Record<string, string>;
export const COUNTY_POP = countyPopulation as unknown as Record<string, [string, number]>;
/** Census 2023 County Business Patterns, NAICS 484210 (moving companies with employees): county FIPS → [establishments, employees]. */
export const COUNTY_MOVING = countyMoving as unknown as Record<string, [number, number | null]>;
export const zipLookup = (zip: string) => ZIPS[zip] || null;
