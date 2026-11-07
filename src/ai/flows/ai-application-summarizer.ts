'use server';

/**
 * Summarizes a job application (and optional resume) for admins, using Gemini.
 * Only signed-in admins may call it.
 */

import { Type } from '@google/genai';
import { requireRoleFromToken } from '@/lib/server/auth';
import { dataUriPart, generateJson } from '@/lib/server/gemini';

export type ApplicationSummarizerInput = {
  /** Applicant details: name, contact, state, experience, licenses, cover letter. */
  applicationText: string;
  /** Resume as a data URI (`data:<mime>;base64,<data>`), if one was uploaded. */
  resumeDataUri: string;
};

export type ApplicationSummarizerOutput = {
  summary: string;
  keySkills: string[];
  relevantExperience: string;
  qualificationMatch: string;
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'Concise overall summary of the applicant, their background and suitability.' },
    keySkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Key skills found in the application and resume.' },
    relevantExperience: { type: Type.STRING, description: 'Work experience relevant to a moving company role, with duration and responsibilities.' },
    qualificationMatch: { type: Type.STRING, description: 'How well stated qualifications (experience, license, CDL) match moving roles.' },
  },
  required: ['summary', 'keySkills', 'relevantExperience', 'qualificationMatch'],
};

export async function aiApplicationSummarizer(
  input: ApplicationSummarizerInput,
  idToken: string
): Promise<ApplicationSummarizerOutput> {
  // Server actions are public endpoints: only signed-in staff may use the AI.
  await requireRoleFromToken(idToken, ['admin']);
  try {
    const resume = dataUriPart(input.resumeDataUri);
    const instructions = [
      'You are an expert HR recruiter for WontStopMoving.com.',
      `Review this job application${resume ? ' and the attached resume' : ''}.`,
      'Summarize the applicant, extract key skills, identify relevant experience and assess how well they match moving company roles.',
      'Only use facts that appear in the application or resume.',
      '',
      'Application details:',
      input.applicationText.slice(0, 20000),
    ].join('\n');
    return await generateJson<ApplicationSummarizerOutput>([{ text: instructions }, ...(resume ? [resume] : [])], SCHEMA);
  } catch (err) {
    console.warn('AI application summary unavailable:', err);
    // Never invent an assessment: say plainly that there isn't one.
    return {
      summary: 'AI summary is unavailable right now. Please review the application below.',
      keySkills: [],
      relevantExperience: 'Not assessed.',
      qualificationMatch: 'Not assessed.',
    };
  }
}
