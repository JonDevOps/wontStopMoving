/**
 * Free distance estimates from ZIP code coordinates (Census Bureau ZIP
 * centers). Road miles are approximated as straight-line miles × 1.25, the
 * usual "circuity" factor for U.S. roads. Pure logic for unit tests.
 */
export const ROAD_FACTOR = 1.25;

export function straightMiles(a: [number, number], b: [number, number]) {
  const r = (d: number) => (d * Math.PI) / 180, R = 3958.8;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated road miles between two ZIP codes, or null if either is unknown. */
export function roadMilesBetween(fromZip: string, toZip: string, lookup: (zip: string) => [number, number] | null | undefined): number | null {
  const a = lookup(String(fromZip || '').trim().slice(0, 5)), b = lookup(String(toZip || '').trim().slice(0, 5));
  if (!a || !b) return null;
  const miles = straightMiles(a, b) * ROAD_FACTOR;
  // Same-ZIP moves still drive a few miles.
  return Math.max(Math.round(miles), String(fromZip).slice(0, 5) === String(toZip).slice(0, 5) ? 3 : 1);
}
