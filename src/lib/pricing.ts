/**
 * @fileOverview Centralized pricing configuration for Wont Stop Moving.
 * Uses the master pricing list provided for residential flat-rates, 
 * hourly labor, and specialized add-ons.
 */

export interface PricingPlan {
  baseFee: number;
  description: string;
}

// Residential Flat-Rate Pricing (Based on the master list provided)
// Using mid-points or high-end for conservative estimates
export const MOVE_PRICING: Record<string, PricingPlan> = {
  'studio': { baseFee: 825, description: "Studio / 1-Bedroom" },
  '1br': { baseFee: 825, description: "Studio / 1-Bedroom" },
  '2br': { baseFee: 1500, description: "2-Bedroom Home" },
  '3br': { baseFee: 2750, description: "3+ Bedroom Home" },
  '4br+': { baseFee: 3500, description: "4+ Bedroom Home" },
  'commercial': { baseFee: 1500, description: "Commercial / Office (Base)" },
};

// Add-on Pricing (Based on mid-points of the provided ranges)
export const ADDON_PRICING: Record<string, number> = {
  'packing': 350,      // Regular Packing ($60-80/hr range estimate)
  'crating': 400,      // Specialty Crating ($200-600 range)
  'cleaning': 425,     // Deep clean ($250-600 range)
  'junk': 250,         // 1/4 truck load ($150-350 range)
  'assembly': 200,     // Handyman ($75-125/hr with 2hr min)
  'storage': 225,      // Vaulted storage ($150-300 range)
  'piano': 450,        // Specialized Item: Piano Upright
};

/**
 * Distance pricing. Local moves include the first `includedMiles` road miles
 * (pickup to drop-off); after that each mile adds `perMile`. Over
 * `longDistanceMiles` it's a long-distance move: we still show an estimate,
 * but recommend a custom quote (fuel, driver hours, tolls, scheduling).
 */
export const MILEAGE = { includedMiles: 25, perMile: 3, longDistanceMiles: 150 } as const;

export function mileageFee(miles: number | null | undefined): number {
  if (typeof miles !== 'number' || !Number.isFinite(miles) || miles <= MILEAGE.includedMiles) return 0;
  return Math.round((miles - MILEAGE.includedMiles) * MILEAGE.perMile);
}
export const isLongDistance = (miles: number | null | undefined) => typeof miles === 'number' && miles > MILEAGE.longDistanceMiles;

/**
 * Service tiers (#144), Uber-style: the same move at three levels of service.
 * The multiplier applies to the move's base (labor) fee only; add-ons, mileage
 * and discounts are unchanged. Names, perks and multipliers are a business
 * setting: edit them here and every price (quote form, checkout) follows.
 */
export type MoveTier = 'saver' | 'standard' | 'premium';
export const MOVE_TIERS: Record<MoveTier, { name: string; tagline: string; multiplier: number; perks: string[] }> = {
  saver: { name: 'Saver', tagline: 'Lowest price, flexible timing', multiplier: 0.85, perks: ['Flexible arrival window', 'You pack, we load and move', 'Standard valuation coverage'] },
  standard: { name: 'Standard', tagline: 'Our most popular move', multiplier: 1, perks: ['Scheduled arrival window', 'Furniture blankets and wrapping', 'Standard valuation coverage'] },
  premium: { name: 'Premium', tagline: 'Priority, hands-off move', multiplier: 1.35, perks: ['Priority scheduling and our top-rated crews', 'Furniture wrapping and disassembly/reassembly', 'Dedicated move coordinator'] },
};
export const isMoveTier = (v: unknown): v is MoveTier => typeof v === 'string' && v in MOVE_TIERS;

export interface PriceCalculationOptions {
  /** Service tier; defaults to standard. */
  tier?: MoveTier;
  isStudent?: boolean;
  isMilitary?: boolean;
  /** 62 or older. */
  isSenior?: boolean;
  isExpress?: boolean;
  /** Estimated road miles between pickup and drop-off (see lib/distance). */
  miles?: number | null;
}

/**
 * Calculates the total estimated price for a move based on size, add-ons, and discounts.
 */
export function calculateMoveTotal(
  moveSize: string, 
  addOns: string[], 
  options: PriceCalculationOptions = {}
): number {
  const plan = MOVE_PRICING[moveSize] || MOVE_PRICING['studio'];
  const tier = MOVE_TIERS[options.tier && isMoveTier(options.tier) ? options.tier : 'standard'];
  let total = plan.baseFee * tier.multiplier;

  // Add-ons
  addOns.forEach(addon => {
    if (ADDON_PRICING[addon]) {
      total += ADDON_PRICING[addon];
    }
  });

  // Distance beyond the included local miles
  total += mileageFee(options.miles);

  // Express Moving: 25% Priority Fee on the base rate
  if (options.isExpress) {
    total += (plan.baseFee * 0.25);
  }

  // Discounts: 5% for students, military or seniors (one discount per move)
  if (options.isStudent || options.isMilitary || options.isSenior) {
    total = total * 0.95;
  }

  return Math.round(total);
}
