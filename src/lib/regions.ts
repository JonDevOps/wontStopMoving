import { METROS } from './metros';

/**
 * Areas you can watch and search: our three hand-picked regions plus every
 * U.S. metro area of 250,000+ people (src/lib/metros.ts, from the Census).
 * Counties are state-county codes ("WA-033"), matching the DOT census's
 * physical county; a metro can span states (New York–Newark, NY-NJ).
 */
export type Area = { states: string[]; counties: string[] };
export type RegionPreset = Area & { label: string; kind: 'region' | 'metro'; city: string; pop: number | null; center: [number, number] | null };

const region = (label: string, city: string, state: string, counties: string[], center: [number, number]): RegionPreset =>
  ({ label, kind: 'region', city, pop: null, states: [state], counties: counties.map(c => `${state}-${c}`), center });

export const REGION_PRESETS: Record<string, RegionPreset> = {
  'bay-area': region('SF Bay Area', 'San Francisco', 'CA', ['001', '013', '041', '055', '075', '081', '085', '095', '097'], [37.65, -122.1]),
  'puget-sound': region('Seattle / Puget Sound', 'Seattle', 'WA', ['033', '053', '061', '035', '067', '029', '045', '057', '031', '055', '073'], [47.5, -122.3]),
  socal: region('Los Angeles / SoCal', 'Los Angeles', 'CA', ['037', '059', '065', '071', '111', '073'], [34.0, -118.1]),
  ...Object.fromEntries(METROS.map(m => [m.key, { ...m, kind: 'metro' as const }])),
};

/** Is a company (state + 3-digit county) inside an area? */
export const inArea = (a: Area, state: string, county: string) => a.counties.includes(`${state}-${county}`);
/** An area's 3-digit counties in one state (for per-state files). */
export const areaCounties = (a: Area, state: string) => a.counties.filter(c => c.startsWith(`${state}-`)).map(c => c.slice(3));
/** Search box matching: "seattle", "WA", "tacoma", "new york"... */
export const matchesRegion = (r: RegionPreset, q: string) => { const s = q.trim().toLowerCase(); return !s || r.label.toLowerCase().includes(s) || r.states.some(x => x.toLowerCase() === s); };
