import { z } from 'zod';

const address = z.string().trim().min(5).max(300);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid date.');
export const moverCartItem = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  providerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  providerName: z.string().max(160).optional(),
  hours: z.number().int().min(2).max(24),
  moveDate: date,
  service: z.enum(['loading', 'unloading', 'packing', 'cleaning', 'heavy']),
  preferredStartTime: z.enum(['morning', 'afternoon', 'evening']),
  pickupAddress: address,
  dropoffAddress: address,
  region: z.string().regex(/^[a-z]{2}$/),
  city: z.string().regex(/^[a-z0-9-]{1,120}$/),
  // Display estimates are never used to calculate the charge.
  quotedRate: z.number().optional(),
});
export const moverCartSchema = z.array(moverCartItem).min(1).max(10).refine(items => new Set(items.map(item => item.id)).size === items.length, 'Duplicate cart item.');
export type MoverCartItem = z.infer<typeof moverCartItem>;
export const MOVER_CART_KEY = 'wsm-mover-cart';
export const REVIEW_REFUND_CENTS = 500;
export const providerShareCents = (cents: number) => Math.round(cents * 0.85);
export const tipShareCents = (cents: number) => cents - Math.round(cents * 0.10);
