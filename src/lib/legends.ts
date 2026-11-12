import type { Mover } from '@/lib/registry';

/**
 * "Legends": the biggest moving companies, by the registry size score
 * (trucks × 10 + drivers × 4 + miles ÷ 25,000):
 *   - the top 500 in the lower 48 (+ DC),
 *   - then the next 100 in each lower-48 time zone (not already in the 500),
 *   - and the top 10 in Alaska and in Hawaii.
 * Time zones are by state; states split between zones go with the zone
 * most of their people live in. Puerto Rico (Atlantic time) isn't included.
 */
export type Zone = 'eastern' | 'central' | 'mountain' | 'pacific' | 'alaska' | 'hawaii';
export const ZONE_LABEL: Record<Zone, string> = { eastern: 'Eastern', central: 'Central', mountain: 'Mountain', pacific: 'Pacific', alaska: 'Alaska', hawaii: 'Hawaii' };

const ZONES: Record<Exclude<Zone, 'alaska' | 'hawaii'>, string[]> = {
  eastern: ['CT', 'DE', 'DC', 'FL', 'GA', 'IN', 'KY', 'ME', 'MD', 'MA', 'MI', 'NH', 'NJ', 'NY', 'NC', 'OH', 'PA', 'RI', 'SC', 'VT', 'VA', 'WV'],
  central: ['AL', 'AR', 'IL', 'IA', 'KS', 'LA', 'MN', 'MS', 'MO', 'NE', 'ND', 'OK', 'SD', 'TN', 'TX', 'WI'],
  mountain: ['AZ', 'CO', 'ID', 'MT', 'NM', 'UT', 'WY'],
  pacific: ['CA', 'NV', 'OR', 'WA'],
};
export const STATE_ZONE: Record<string, Zone> = { AK: 'alaska', HI: 'hawaii', ...Object.fromEntries(Object.entries(ZONES).flatMap(([z, states]) => states.map(s => [s, z as Zone]))) };

export const LEGEND_SIZES = { national: 500, perZone: 100, alaska: 10, hawaii: 10 } as const;
export type LegendGroup = 'national' | Zone;
export const GROUP_LABEL: Record<LegendGroup, string> = { national: 'Top 500 (lower 48)', eastern: 'Eastern: next 100', central: 'Central: next 100', mountain: 'Mountain: next 100', pacific: 'Pacific: next 100', alaska: 'Alaska: top 10', hawaii: 'Hawaii: top 10' };

/** `size` is the registry size score (sizeScore in registry.ts). */
export function buildLegends<T extends Pick<Mover, 'dot' | 'state'>>(rows: T[], size: (m: T) => number): Record<LegendGroup, T[]> {
  const sorted = [...rows].sort((a, b) => size(b) - size(a));
  const zone = (m: T) => STATE_ZONE[m.state];
  const lower48 = sorted.filter(m => zone(m) && zone(m) !== 'alaska' && zone(m) !== 'hawaii');
  const national = lower48.slice(0, LEGEND_SIZES.national);
  const taken = new Set(national.map(m => m.dot));
  const next = (z: Zone, n: number) => sorted.filter(m => zone(m) === z && !taken.has(m.dot)).slice(0, n);
  return {
    national,
    eastern: next('eastern', LEGEND_SIZES.perZone), central: next('central', LEGEND_SIZES.perZone),
    mountain: next('mountain', LEGEND_SIZES.perZone), pacific: next('pacific', LEGEND_SIZES.perZone),
    alaska: next('alaska', LEGEND_SIZES.alaska), hawaii: next('hawaii', LEGEND_SIZES.hawaii),
  };
}

/**
 * A rough yearly revenue range from fleet size: about $150k-$250k per truck
 * is typical for household movers. An estimate to compare companies, not
 * their reported revenue.
 */
export const REVENUE_PER_TRUCK = { low: 150_000, high: 250_000 } as const;
export const revenueRange = (m: Pick<Mover, 'units'>) => ({ low: m.units * REVENUE_PER_TRUCK.low, high: m.units * REVENUE_PER_TRUCK.high });

/** Franchise networks and van line brands, recognized from a company's name, DBA or website. */
export const BRANDS: { key: string; label: string; kind: 'franchise' | 'van line' | 'chain'; match: RegExp }[] = [
  { key: 'two-men', label: 'Two Men and a Truck', kind: 'franchise', match: /two\s*men\s*and\s*a\s*truck|twomen\.com/i },
  { key: 'college-hunks', label: 'College Hunks Hauling Junk & Moving', kind: 'franchise', match: /college\s*hunks|collegehunkshaulingjunk/i },
  { key: 'bellhop', label: 'Bellhop', kind: 'chain', match: /\bbellhops?\b|getbellhops/i },
  { key: 'all-my-sons', label: 'All My Sons Moving & Storage', kind: 'chain', match: /all\s*my\s*sons|allmysons/i },
  { key: 'jk-moving', label: 'JK Moving Services', kind: 'chain', match: /\bjk\s*moving|jkmoving/i },
  { key: 'pods', label: 'PODS', kind: 'chain', match: /\bpods\b|pods\.com/i },
  { key: 'pack-rat', label: '1-800-PACK-RAT', kind: 'chain', match: /pack[\s-]*rat/i },
  { key: 'allied', label: 'Allied Van Lines', kind: 'van line', match: /allied\s*van|allied\.com|agent\s*(for|of)\s*allied/i },
  { key: 'north-american', label: 'North American Van Lines', kind: 'van line', match: /north\s*american\s*van|northamerican\.com/i },
  { key: 'atlas', label: 'Atlas Van Lines', kind: 'van line', match: /\batlas\s*(van|world|moving|relocation)|atlasvanlines/i },
  { key: 'united', label: 'United Van Lines', kind: 'van line', match: /united\s*van\s*lines|unitedvanlines/i },
  { key: 'mayflower', label: 'Mayflower', kind: 'van line', match: /mayflower/i },
  { key: 'bekins', label: 'Bekins', kind: 'van line', match: /bekins/i },
  { key: 'wheaton', label: 'Wheaton', kind: 'van line', match: /wheaton\s*(world|van|moving)|wheatonworldwide/i },
  { key: 'arpin', label: 'Arpin', kind: 'van line', match: /\barpin\b/i },
  { key: 'graebel', label: 'Graebel', kind: 'van line', match: /graebel/i },
  { key: 'suddath', label: 'Suddath', kind: 'van line', match: /suddath/i },
  { key: 'stevens', label: 'Stevens Worldwide', kind: 'van line', match: /stevens\s*(worldwide|van)/i },
  { key: 'u-pack', label: 'U-Pack (ABF)', kind: 'chain', match: /\bu[\s-]?pack\b|upack\.com/i },
];

export function brandOf(m: Pick<Mover, 'name' | 'dba' | 'site'> & { foundSite?: string | null }): (typeof BRANDS)[number] | null {
  const text = [m.name, m.dba, m.site, m.foundSite].filter(Boolean).join(' ');
  return BRANDS.find(b => b.match.test(text)) || null;
}
