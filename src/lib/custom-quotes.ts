import { z } from 'zod';

const money = z.number().finite().min(0.5).max(999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, 'Use at most two decimal places.');
export const customQuoteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
  description: z.string().trim().min(1).max(3000),
  pickupAddress: z.string().trim().min(1).max(500),
  dropoffAddress: z.string().trim().min(1).max(500),
  moveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, 'Enter a valid move date.'),
  expiresAt: z.string().datetime(),
  pricing: z.discriminatedUnion('type', [
    z.object({ type: z.literal('fixed'), total: money }).strict(),
    z.object({ type: z.literal('hourly'), hourlyRate: money, minimumHours: z.number().finite().min(0.5).max(1000), estimatedHours: z.number().finite().min(0.5).max(1000) }).strict(),
  ]),
}).strict().refine(q => q.pricing.type !== 'hourly' || q.pricing.estimatedHours >= q.pricing.minimumHours, 'Estimated hours must meet the minimum.');
export type CustomPricing = z.infer<typeof customQuoteSchema>['pricing'];
export function customQuoteTotal(pricing: CustomPricing): number {
  return pricing.type === 'fixed' ? pricing.total : Math.round(pricing.hourlyRate * pricing.estimatedHours * 100) / 100;
}
export function customQuotePricingText(pricing: CustomPricing): string {
  return pricing.type === 'fixed' ? `Fixed total: $${pricing.total.toFixed(2)}` : `$${pricing.hourlyRate.toFixed(2)}/hour; ${pricing.minimumHours}-hour minimum; ${pricing.estimatedHours} estimated hours. Estimated total: $${customQuoteTotal(pricing).toFixed(2)}. Final total may change with hours worked. This is an estimate, not a payment request.`;
}
