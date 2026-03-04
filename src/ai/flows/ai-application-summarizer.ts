'use server';
/**
 * @fileOverview An AI agent that summarizes job applications.
 *
 * - aiApplicationSummarizer - A function that handles the job application summarization process.
 * - ApplicationSummarizerInput - The input type for the aiApplicationSummarizer function.
 * - ApplicationSummarizerOutput - The return type for the aiApplicationSummarizer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ApplicationSummarizerInputSchema = z.object({
  applicationText: z
    .string()
    .describe(
      'Comprehensive text detailing the applicant\'s information, such as name, email, phone, state, years of experience, driver\'s license status, CDL status, and cover letter content.'
    ),
  resumeDataUri: z
    .string()
    .describe(
      "The applicant's resume as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ApplicationSummarizerInput = z.infer<
  typeof ApplicationSummarizerInputSchema
>;

const ApplicationSummarizerOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise overall summary of the applicant, their background, and suitability.'),
  keySkills: z.array(z.string()).describe('A list of key skills extracted from the application and resume.'),
  relevantExperience: z
    .string()
    .describe(
      'A summary of the applicant\'s work experience most relevant to a moving company role, including duration and responsibilities.'
    ),
  qualificationMatch: z
    .string()
    .describe(
      'An assessment of how well the applicant\'s stated qualifications (e.g., years of experience, driver\'s license, CDL) match the general requirements for moving roles.'
    ),
});
export type ApplicationSummarizerOutput = z.infer<
  typeof ApplicationSummarizerOutputSchema
>;

export async function aiApplicationSummarizer(
  input: ApplicationSummarizerInput
): Promise<ApplicationSummarizerOutput> {
  return aiApplicationSummarizerFlow(input);
}

const summarizeApplicationPrompt = ai.definePrompt({
  name: 'summarizeApplicationPrompt',
  input: { schema: ApplicationSummarizerInputSchema },
  output: { schema: ApplicationSummarizerOutputSchema },
  prompt: `You are an AI assistant acting as an expert HR recruiter for WontStopMoving.com. Your task is to review a job application and the accompanying resume to provide a concise summary, extract key skills, identify relevant experience, and assess the applicant's qualification match for moving company roles.

Application Details: {{{applicationText}}}
Resume: {{media url=resumeDataUri}}

Based on the provided information, please generate a structured summary as a JSON object.`,
});

const aiApplicationSummarizerFlow = ai.defineFlow(
  {
    name: 'aiApplicationSummarizerFlow',
    inputSchema: ApplicationSummarizerInputSchema,
    outputSchema: ApplicationSummarizerOutputSchema,
  },
  async (input) => {
    const { output } = await summarizeApplicationPrompt(input);
    return output!;
  }
);
