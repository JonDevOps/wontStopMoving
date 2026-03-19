/**
 * @fileOverview Centralized pricing configuration for Wont Stop Moving.
 * Uses the master pricing list provided for residential flat-rates, 
 * hourly labor, and specialized add-ons.
 */

export interface PricingPlan {
  baseFee: number;
  description: string;
}

// Residential Flat-Rate Pricing (Mid-range estimates for the automated quote)
export const MOVE_PRICING: Record<string, PricingPlan> = {
  'studio': { baseFee: 700, description: "Studio Apartment" },
  '1br': { baseFee: 850, description: "1 Bedroom Home" },
  '2br': { baseFee: 1500, description: "2 Bedroom Home" },
  '3br': { baseFee: 2500, description: "3 Bedroom Home" },
  '4br+': { baseFee: 3500, description: "4+ Bedroom Home" },
  'commercial': { baseFee: 1200, description: "Commercial/Office (Base)" },
};

// Add-on Pricing (Fixed mid-range for estimates)
export const ADDON_PRICING: Record<string, number> = {
  'packing': 300,      // Regular Packing range mid-point
  'crating': 400,      // Specialty Crating mid-point
  'cleaning': 400,     // Deep clean mid-point
  'junk': 250,         // 1/4 truck load mid-point
  'assembly': 200,     // 2hr min @ $100/hr mid-point
  'storage': 225,      // Per month vault mid-point
};

export interface PriceCalculationOptions {
  isStudent?: boolean;
  isMilitary?: boolean;
  isExpress?: boolean;
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
  let total = plan.baseFee;

  // Add-ons
  addOns.forEach(addon => {
    if (ADDON_PRICING[addon]) {
      total += ADDON_PRICING[addon];
    }
  });

  // Express Moving: 25% Priority Fee on the base rate
  if (options.isExpress) {
    total += (plan.baseFee * 0.25);
  }

  // Discounts: 5% for Students or Military (not cumulative for MVP)
  if (options.isStudent || options.isMilitary) {
    total = total * 0.95;
  }

  return Math.round(total);
}
