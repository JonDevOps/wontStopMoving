/**
 * Competitor price watch: compares two price readings of the same website and
 * lists what changed. Pure, so it can be tested directly. Small wobbles (under
 * $5 or 3%) are ignored because prices are read by AI from page text.
 */
export type PriceReading = {
  published: boolean; twoMovers: number | null; threeMovers: number | null; fourMovers: number | null; minimumHours: number | null; travelFee: number | null;
  flat: { studio: number | null; oneBedroom: number | null; twoBedroom: number | null; threeBedroom: number | null; fourBedroom: number | null };
};
export type PriceChange = { field: string; label: string; from: number; to: number; pct: number };

const FIELDS: [string, string, (p: PriceReading) => number | null][] = [
  ['twoMovers', '2 movers/hr', p => p.twoMovers],
  ['threeMovers', '3 movers/hr', p => p.threeMovers],
  ['fourMovers', '4 movers/hr', p => p.fourMovers],
  ['minimumHours', 'Minimum hours', p => p.minimumHours],
  ['travelFee', 'Travel fee', p => p.travelFee],
  ['flat.studio', 'Studio flat', p => p.flat?.studio ?? null],
  ['flat.oneBedroom', '1-bedroom flat', p => p.flat?.oneBedroom ?? null],
  ['flat.twoBedroom', '2-bedroom flat', p => p.flat?.twoBedroom ?? null],
  ['flat.threeBedroom', '3-bedroom flat', p => p.flat?.threeBedroom ?? null],
  ['flat.fourBedroom', '4-bedroom flat', p => p.flat?.fourBedroom ?? null],
];

export function diffPrices(before: PriceReading | null | undefined, after: PriceReading | null | undefined): PriceChange[] {
  if (!before?.published || !after?.published) return [];
  const out: PriceChange[] = [];
  for (const [field, label, get] of FIELDS) {
    const a = get(before), b = get(after);
    if (typeof a !== 'number' || typeof b !== 'number' || a <= 0) continue;
    const isHours = field === 'minimumHours';
    const delta = Math.abs(b - a);
    if (isHours ? delta < 0.5 : delta < 5 || delta / a < 0.03) continue;
    out.push({ field, label, from: a, to: b, pct: Math.round(((b - a) / a) * 100) });
  }
  return out;
}

export const describeChange = (c: PriceChange) =>
  c.field === 'minimumHours' ? `${c.label} ${c.from} → ${c.to}` : `${c.label} $${c.from} → $${c.to} (${c.pct > 0 ? '+' : ''}${c.pct}%)`;

/** Tracked competitors are re-read weekly; other movers monthly. */
export const REFRESH_DAYS = { competitor: 7, registry: 30 } as const;
