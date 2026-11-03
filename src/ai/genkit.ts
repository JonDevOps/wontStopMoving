import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    }),
  ],
  // Uses Google's rolling latest Gemini Flash alias so model deprecations never break AI features
  model: 'googleai/gemini-flash-latest',
});
