/**
 * @fileOverview Centralized pricing configuration for Wont Stop Moving.
 * Uses a hybrid model of fixed base fees and estimated hourly labor.
 */

export interface PricingPlan {
  baseFee: number;
  hourlyRate: number;
  moversCount: number;
  estimatedHours: number;
}

export const MOVE_PRICING: Record<string, PricingPlan> = {
  'studio': { baseFee: 199, hourlyRate: 90, moversCount: 2, estimatedHours: 3 },
  '1br': { baseFee: 299, hourlyRate: 90, moversCount: 2, estimatedHours: 5 },
  '2br': { baseFee: 399, hourlyRate: 135, moversCount: 3, estimatedHours: 7 },
  '3br': { baseFee: 499, hourlyRate: 135, moversCount: 3, estimatedHours: 9 },
  '4br+': { baseFee: 699, hourlyRate: 180, moversCount: 4, estimatedHours: 12 },
  'commercial': { baseFee: 799, hourlyRate: 180, moversCount: 4, estimatedHours: 8 },
};

export const ADDON_PRICING: Record<string, number> = {
  'packing': 150,
  'crating': 200,
  'cleaning': 199,
  'junk': 99,
  'assembly': 75,
  'storage': 150,
  'express': 250,
};

/**
 * Calculates the total estimated price for a move based on size and selected add-ons.
 */
export function calculateMoveTotal(moveSize: string, addOns: string[]): number {
  const plan = MOVE_PRICING[moveSize] || MOVE_PRICING['studio'];
  
  let total = plan.baseFee + (plan.hourlyRate * plan.estimatedHours);
  
  addOns.forEach(addon => {
    if (ADDON_PRICING[addon]) {
      total += ADDON_PRICING[addon];
    }
  });
  
  return total;
}
