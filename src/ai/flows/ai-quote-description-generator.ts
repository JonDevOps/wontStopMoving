'use server';
/**
 * @fileOverview This file implements a Genkit flow to generate a professional and detailed
 * description of moving services and pricing for a customer quote.
 *
 * - generateQuoteDescription - A function that handles the quote description generation process.
 * - GenerateQuoteDescriptionInput - The input type for the generateQuoteDescription function.
 * - GenerateQuoteDescriptionOutput - The return type for the generateQuoteDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuoteDescriptionInputSchema = z.object({
  moveSize: z
    .enum([
      'studio',
      '1br',
      '2br',
      '3br',
      '4br+',
      'commercial',
    ])
    .describe('The size of the move, e.g., studio, 1br, commercial.'),
  specialItems: z
    .string()
    .optional()
    .describe('Any special items requiring extra care or equipment.'),
  pickupAddress: z.string().describe('The full pickup address for the move.'),
  dropoffAddress: z
    .string()
    .describe('The full dropoff address for the move.'),
  estimatedHours: z
    .number()
    .describe('The estimated number of hours for the move.'),
  price: z.number().describe('The quoted price for the moving services.'),
});
export type GenerateQuoteDescriptionInput = z.infer<
  typeof GenerateQuoteDescriptionInputSchema
>;

const GenerateQuoteDescriptionOutputSchema = z.object({
  description: z
    .string()
    .describe('A professional and detailed description for the customer quote.'),
});
export type GenerateQuoteDescriptionOutput = z.infer<
  typeof GenerateQuoteDescriptionOutputSchema
>;

export async function generateQuoteDescription(
  input: GenerateQuoteDescriptionInput
): Promise<GenerateQuoteDescriptionOutput> {
  return generateQuoteDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuoteDescriptionPrompt',
  input: {schema: GenerateQuoteDescriptionInputSchema},
  output: {schema: GenerateQuoteDescriptionOutputSchema},
  prompt: `You are an AI assistant for WontStopMoving.com, a professional moving company.
Your task is to generate a professional, detailed, and clear description for a customer's moving quote.
This description should outline the services included, key details of the move, and the total quoted price.

Be thorough, friendly, and reassuring, highlighting our commitment to a smooth moving experience.

Move Details:
- Move Size: {{{moveSize}}}
- Pickup Address: {{{pickupAddress}}}
- Dropoff Address: {{{dropoffAddress}}}
- Estimated Hours: {{{estimatedHours}}} hours
- Special Items: {{#if specialItems}}{{{specialItems}}}{{else}}None specified.{{/if}}
- Quoted Price: \${{{price}}}.

Based on these details, please generate a comprehensive quote description for the customer.`,
});

const generateQuoteDescriptionFlow = ai.defineFlow(
  {
    name: 'generateQuoteDescriptionFlow',
    inputSchema: GenerateQuoteDescriptionInputSchema,
    outputSchema: GenerateQuoteDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
