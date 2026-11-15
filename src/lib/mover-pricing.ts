export const MIN_PROVIDER_RATE = 45;
export const MIN_BOOKING_HOURS = 2;

/** Legacy rates below the floor must be corrected by the provider, never silently increased. */
export function validProviderPricing(rate: unknown, hours: unknown): boolean {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_PROVIDER_RATE && rate <= 1000 && Math.abs(rate * 100 - Math.round(rate * 100)) < 0.00001 && typeof hours === 'number' && Number.isInteger(hours) && hours >= MIN_BOOKING_HOURS && hours <= 24;
}
