import { GoogleGenAI, type Part, type Schema } from "@google/genai";

/**
 * Gemini, called directly through Google's SDK (no Genkit).
 * Key: the GEMINI_API_KEY App Hosting secret (already wired in apphosting.yaml).
 */

// Google's rolling "latest Flash" alias, so model retirements don't break features.
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-flash-latest";

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey }));
}

/** Asks Gemini for JSON matching `schema` and parses it. */
export async function generateJson<T>(parts: Part[], schema: Schema): Promise<T> {
  const response = await gemini().models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as T;
}

/**
 * Asks Gemini with Google Search grounding (live web results). Free up to
 * Google's monthly grounding allowance on the Gemini API. Returns the answer
 * text and the web pages it was grounded on.
 */
export async function searchGrounded(prompt: string): Promise<{ text: string; sources: { uri: string; title: string }[] }> {
  const response = await gemini().models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }], temperature: 0.1 },
  });
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return {
    text: response.text || "",
    sources: chunks.map(c => ({ uri: c.web?.uri || "", title: c.web?.title || "" })).filter(s => s.uri),
  };
}

/** Turns a `data:<mime>;base64,<data>` URI into an inline Gemini part. */
export function dataUriPart(dataUri: string): Part | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUri || "");
  return match ? { inlineData: { mimeType: match[1], data: match[2] } } : null;
}
