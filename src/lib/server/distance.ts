import { ZIPS } from './geo';
import { roadMilesBetween } from '@/lib/distance';

/** Estimated road miles between two U.S. ZIP codes (server-side, authoritative for pricing). */
export const zipRoadMiles = (fromZip: unknown, toZip: unknown) => roadMilesBetween(String(fromZip || ''), String(toZip || ''), z => ZIPS[z]);
