import { METROS, type Metro } from '@/lib/metros';
import { calculateMoveTotal, MOVE_PRICING } from '@/lib/pricing';

/**
 * "How much do movers cost in <city>?" pages for the 100 largest U.S. metros.
 * Prices come from our own published pricing (lib/pricing), so the page and
 * the quote form always agree.
 */
export const COST_CITY_COUNT = 100;

const slugify = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Main state of a metro, from its label ("Portland–Vancouver–Hillsboro, OR-WA" → "OR"). */
export const metroState = (m: Metro) => (m.label.split(', ').pop() || '').split('-')[0];

export type CostCity = { slug: string; city: string; citySlug: string; state: string; label: string; pop: number; rank: number };

export const COST_CITIES: CostCity[] = METROS.slice(0, COST_CITY_COUNT).map((m, i) => ({
  slug: `${slugify(m.city)}-${metroState(m).toLowerCase()}`,
  city: m.city,
  citySlug: slugify(m.city),
  state: metroState(m),
  label: m.label,
  pop: m.pop,
  rank: i + 1,
}));

export const costCity = (slug: string) => COST_CITIES.find(c => c.slug === slug) || null;

export const ESTIMATE_SIZES = ['studio', '2br', '3br', '4br+'] as const;
/** Sample distances: across town, across the metro, to a nearby city. */
export const SAMPLE_MILES = [10, 40, 120] as const;

/** Our flat price for each home size at each sample distance. */
export function sampleCosts() {
  return ESTIMATE_SIZES.map(size => ({
    size,
    label: MOVE_PRICING[size].description,
    prices: SAMPLE_MILES.map(miles => calculateMoveTotal(size, [], { miles })),
  }));
}
