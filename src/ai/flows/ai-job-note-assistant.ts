'use server';
/**
 * @fileOverview An AI assistant flow for employees to quickly draft structured notes or summarize observations about a move.
 *
 * - aiJobNoteAssistant - A function that handles the AI note assistance process.
 * - AiJobNoteAssistantInput - The input type for the aiJobNoteAssistant function.
 * - AiJobNoteAssistantOutput - The return type for the aiJobNoteAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiJobNoteAssistantInputSchema = z.object({
  rawNotes: z
    .string()
    .describe(
      'Employee\'s unstructured raw notes or observations about the job.'
    ),
  jobDetails: z
    .string()
    .describe(
      'Contextual details about the job, such as move size, special items, pickup/dropoff addresses, and customer notes. This helps the AI structure the notes.'
    ),
});
export type AiJobNoteAssistantInput = z.infer<
  typeof AiJobNoteAssistantInputSchema
>;

const AiJobNoteAssistantOutputSchema = z.object({
  structuredNotes: z
    .string()
    .describe('AI-generated structured and summarized notes for the job.'),
});
export type AiJobNoteAssistantOutput = z.infer<
  typeof AiJobNoteAssistantOutputSchema
>;

export async function aiJobNoteAssistant(
  input: AiJobNoteAssistantInput
): Promise<AiJobNoteAssistantOutput> {
  return aiJobNoteAssistantFlow(input);
}

const aiJobNoteAssistantPrompt = ai.definePrompt({
  name: 'aiJobNoteAssistantPrompt',
  input: { schema: AiJobNoteAssistantInputSchema },
  output: { schema: AiJobNoteAssistantOutputSchema },
  prompt: `You are an AI assistant helping a moving company employee structure and summarize their job notes.

Here are the job details for context:
{{{jobDetails}}}

Here are the employee's raw notes:
{{{rawNotes}}}

Your task is to take these raw notes and, using the job details as context, generate structured and summarized notes. Focus on clarity, conciseness, and key observations relevant to the move.

Structure the output clearly, for example, by using bullet points or distinct paragraphs for different aspects like 'Observations', 'Issues Encountered', 'Customer Feedback', etc., as appropriate based on the raw notes.

Ensure the structured notes are ready for official record-keeping.`,
});

const aiJobNoteAssistantFlow = ai.defineFlow(
  {
    name: 'aiJobNoteAssistantFlow',
    inputSchema: AiJobNoteAssistantInputSchema,
    outputSchema: AiJobNoteAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await aiJobNoteAssistantPrompt(input);
    return output!;
  }
);
