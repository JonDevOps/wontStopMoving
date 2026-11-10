'use server';

/**
 * Writes the customer-facing description for a quote, using Gemini.
 * Only signed-in admins may call it.
 */

import { Type } from '@google/genai';
import { requireRoleFromToken } from '@/lib/server/auth';
import { generateJson } from '@/lib/server/gemini';

export type GenerateQuoteDescriptionInput = {
  moveSize: 'studio' | '1br' | '2br' | '3br' | '4br+' | 'commercial';
  specialItems?: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedHours: number;
  price: number;
};

export type GenerateQuoteDescriptionOutput = { description: string };

const SCHEMA = {
  type: Type.OBJECT,
  properties: { description: { type: Type.STRING, description: 'Professional, detailed description for the customer quote.' } },
  required: ['description'],
};

export async function generateQuoteDescription(
  input: GenerateQuoteDescriptionInput,
  idToken: string
): Promise<GenerateQuoteDescriptionOutput> {
  // Server actions are public endpoints: only signed-in staff may use the AI.
  await requireRoleFromToken(idToken, ['admin']);
  try {
    const instructions = [
      'You write customer quote descriptions for WontStopMoving.com, a moving company.',
      'Write a professional, clear and friendly description of this quote: the services included, the key move details and the total price.',
      'Payment is released to the movers only when the customer gives their 6-digit release code.',
      'Do not promise services, guarantees or insurance that are not listed here.',
      '',
      'Move details:',
      `- Move size: ${input.moveSize}`,
      `- Pickup: ${input.pickupAddress}`,
      `- Drop-off: ${input.dropoffAddress}`,
      `- Estimated hours: ${input.estimatedHours}`,
      `- Special items: ${input.specialItems || 'None specified'}`,
      `- Quoted price: $${input.price}`,
    ].join('\n');
    return await generateJson<GenerateQuoteDescriptionOutput>([{ text: instructions }], SCHEMA);
  } catch (err) {
    console.warn('AI quote description unavailable, using the standard template:', err);
    return {
      description: [
        `Thank you for choosing Wont Stop Moving for your upcoming ${input.moveSize.toUpperCase()} relocation from ${input.pickupAddress} to ${input.dropoffAddress}.`,
        ``,
        `Your $${input.price.toLocaleString()} quote (${input.estimatedHours} estimated hours) includes:`,
        `• A professional moving crew and truck`,
        `• Furniture padding and floor/doorway protection`,
        input.specialItems ? `• Special handling for: ${input.specialItems}` : `• Standard household items`,
        `• Pay-after-completion protection: your movers are paid only after the move is complete and you confirm with your 6-digit release code.`,
      ].join('\n'),
    };
  }
}
