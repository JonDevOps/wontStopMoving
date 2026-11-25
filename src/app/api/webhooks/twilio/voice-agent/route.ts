import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { adminDb } from '@/lib/server/firebase-admin';
import { MENU, SITE, spokenNumber, voiceEnabled } from '@/lib/server/phone';

/**
 * The owner's phone answered (#159). Says who is calling and what they chose,
 * and only connects when a key is pressed, so a personal voicemail can't
 * swallow a business call.
 */
export async function POST(req: Request) { try {
  const url = new URL(req.url);
  const p = await readTwilioWebhook(req, '/api/webhooks/twilio/voice-agent');
  const call = url.searchParams.get('call') || '', choice = url.searchParams.get('choice') || '';
  if (!voiceEnabled() || p.From !== BUSINESS_CONTACT.phone || !/^CA[a-f0-9]{32}$/i.test(call)) throw new HttpError(503, 'Voice routing is not activated.');
  const log = (await adminDb().doc(`phoneInbox/${call}`).get()).data();
  const who = log?.knownName ? `${log.knownName}, ` : '';
  return twiml(`<Gather input="dtmf" numDigits="1" timeout="10" action="${SITE}/api/webhooks/twilio/voice-agent-accept?call=${call}" method="POST"><Say>Won&apos;t Stop Moving call from ${who}${spokenNumber(log?.phone || '')}, for ${MENU[choice]?.spoken || 'support'}. Press 1 to connect.</Say></Gather><Say>Call not connected. It is in your call log.</Say><Hangup/>`);
} catch (error) { return errorResponse(error); } }
