import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { HOLD_LIMIT_SECONDS, SITE, WAIT_MESSAGE, voiceEnabled } from '@/lib/server/phone';

/** Hold loop (#169): ~30 s of soft music, then the wait message; leaves the queue after 90 s. */
export async function POST(req: Request) { try {
  const p = await readTwilioWebhook(req, '/api/webhooks/twilio/voice-hold');
  if (!voiceEnabled()) throw new HttpError(503, 'Voice routing is not activated.');
  if (Number(p.QueueTime || 0) >= HOLD_LIMIT_SECONDS) return twiml('<Leave/>');
  return twiml(`<Play>${SITE}/audio/hold-music.wav</Play><Say>${WAIT_MESSAGE}</Say>`);
} catch (error) { return errorResponse(error); } }
