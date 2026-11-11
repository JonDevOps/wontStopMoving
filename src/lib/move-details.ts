/**
 * Move details staff can change after booking: date, arrival window,
 * addresses, size, reserved hours, special items and access notes.
 * Pure logic (no imports) so it can be unit-tested directly.
 */
export const MOVE_SIZES: Record<string, string> = {
  studio: 'Studio / 1-bedroom', '1br': '1-bedroom', '2br': '2-bedroom', '3br': '3-bedroom', '4br+': '4+ bedroom', commercial: 'Commercial / office', custom: 'Custom',
};

export type MoveDetails = {
  moveDate: string; moveTime: string; pickupAddress: string; dropoffAddress: string;
  moveSize: string; hoursReserved: number | null; specialItems: string; accessNotes: string;
};
export type MoveDetailKey = keyof MoveDetails;

export const MOVE_DETAIL_LABELS: Record<MoveDetailKey, string> = {
  moveDate: 'Move date', moveTime: 'Arrival window', pickupAddress: 'Pickup address', dropoffAddress: 'Drop-off address',
  moveSize: 'Move size', hoursReserved: 'Reserved hours', specialItems: 'Special items', accessNotes: 'Access notes (stairs, elevator, parking)',
};
/** Changes the customer should hear about. */
export const CUSTOMER_FACING: MoveDetailKey[] = ['moveDate', 'moveTime', 'pickupAddress', 'dropoffAddress', 'hoursReserved'];

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Validates the fields present in `raw`; fields not sent are left out. */
export function cleanMoveDetails(raw: Record<string, unknown>): { ok: true; data: Partial<MoveDetails> } | { ok: false; error: string } {
  const data: Partial<MoveDetails> = {};
  if ('moveDate' in raw) {
    const d = typeof raw.moveDate === 'string' ? raw.moveDate.trim() : '';
    const [y, m, day] = d.split('-').map(Number);
    const real = /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(Date.UTC(y, m - 1, day)).toISOString().slice(0, 10) === d;
    if (!real) return { ok: false, error: 'Choose a valid move date.' };
    data.moveDate = d;
  }
  if ('moveTime' in raw) data.moveTime = s(raw.moveTime, 60);
  for (const k of ['pickupAddress', 'dropoffAddress'] as const) {
    if (!(k in raw)) continue;
    const v = s(raw[k], 300);
    if (v.length < 3) return { ok: false, error: `Enter the ${k === 'pickupAddress' ? 'pickup' : 'drop-off'} address.` };
    data[k] = v;
  }
  if ('moveSize' in raw) {
    const v = s(raw.moveSize, 20);
    if (!(v in MOVE_SIZES)) return { ok: false, error: 'Choose a move size.' };
    data.moveSize = v;
  }
  if ('hoursReserved' in raw) {
    const v = raw.hoursReserved;
    if (v === null || v === '') data.hoursReserved = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 72) return { ok: false, error: 'Reserved hours must be between 0.5 and 72.' };
      data.hoursReserved = Math.round(n * 2) / 2;
    }
  }
  if ('specialItems' in raw) data.specialItems = s(raw.specialItems, 1000);
  if ('accessNotes' in raw) data.accessNotes = s(raw.accessNotes, 1000);
  return { ok: true, data };
}

export type MoveChange = { field: MoveDetailKey; label: string; from: string; to: string };
const show = (k: MoveDetailKey, v: unknown) => (v === null || v === undefined || v === '' ? '—' : k === 'moveSize' ? MOVE_SIZES[String(v)] || String(v) : String(v));

/** What actually changed between the stored job and the update. */
export function diffMoveDetails(before: Record<string, unknown>, update: Partial<MoveDetails>): MoveChange[] {
  return (Object.keys(update) as MoveDetailKey[])
    .filter(k => show(k, before[k]) !== show(k, update[k]))
    .map(k => ({ field: k, label: MOVE_DETAIL_LABELS[k], from: show(k, before[k]), to: show(k, update[k]) }));
}

/** "Saturday, December 20, 2026" from "2026-12-20", without timezone drift. */
export function formatMoveDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return typeof value === 'string' && value ? value : 'Date not set';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
