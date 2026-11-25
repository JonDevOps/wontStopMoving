import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { FieldValue } from 'firebase-admin/firestore';
import { logCall, voiceEnabled } from '@/lib/server/phone';

/** Owner pressed a key: connect to the waiting caller. */
export async function POST(req: Request) { try {
  const url = new URL(req.url);
  const p = await readTwilioWebhook(req, '/api/webhooks/twilio/voice-agent-accept');
  const call = url.searchParams.get('call') || '';
  if (!voiceEnabled() || p.From !== BUSINESS_CONTACT.phone || !/^CA[a-f0-9]{32}$/i.test(call)) throw new HttpError(503, 'Voice routing is not activated.');
  if (p.Digits !== '1') return twiml('<Say>Call not connected.</Say><Hangup/>');
  await logCall(call, { status: 'answered', answeredAt: FieldValue.serverTimestamp() });
  return twiml(`<Dial><Queue>wsm-${call}</Queue></Dial><Say>The caller already hung up. Their number is in your call log.</Say><Hangup/>`);
} catch (error) { return errorResponse(error); } }
