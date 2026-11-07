'use server';

/**
 * Turns a crew member's raw field notes into structured notes, using Gemini.
 * Only signed-in crew (employees) and admins may call it.
 */

import { Type } from '@google/genai';
import { requireRoleFromToken } from '@/lib/server/auth';
import { generateJson } from '@/lib/server/gemini';

export type AiJobNoteAssistantInput = {
  /** The crew member's unstructured notes. */
  rawNotes: string;
  /** Job context: move size, special items, addresses, customer notes. */
  jobDetails: string;
};

export type AiJobNoteAssistantOutput = { structuredNotes: string };

const SCHEMA = {
  type: Type.OBJECT,
  properties: { structuredNotes: { type: Type.STRING, description: 'Structured, summarized notes in Markdown.' } },
  required: ['structuredNotes'],
};

export async function aiJobNoteAssistant(
  input: AiJobNoteAssistantInput,
  idToken: string
): Promise<AiJobNoteAssistantOutput> {
  // Server actions are public endpoints: only signed-in staff may use the AI.
  await requireRoleFromToken(idToken, ['employee', 'admin']);
  try {
    const instructions = [
      'You help a moving company crew member structure their job notes for the official record.',
      'Using the job details as context, rewrite the raw notes clearly and concisely, with Markdown headings or bullets',
      'such as Observations, Issues Encountered and Customer Feedback where they apply. Do not add anything that is not in the notes.',
      '',
      'Job details:',
      input.jobDetails.slice(0, 4000),
      '',
      'Raw notes:',
      input.rawNotes.slice(0, 8000),
    ].join('\n');
    return await generateJson<AiJobNoteAssistantOutput>([{ text: instructions }], SCHEMA);
  } catch (err) {
    console.warn('AI note assistant unavailable:', err);
    // Keep the crew's own words; don't invent observations.
    return {
      structuredNotes: [
        '### Job Context',
        `- ${input.jobDetails || 'Not provided'}`,
        '',
        '### Field Notes',
        input.rawNotes.trim() || '- (no notes)',
        '',
        '_AI formatting is unavailable right now; notes saved as written._',
      ].join('\n'),
    };
  }
}
