import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { MENU, SITE, WAIT_MESSAGE, logCall, ringAgent, voiceEnabled } from '@/lib/server/phone';

/** Menu choice (#182). No key press twice = likely robocall: logged and hung up. */
export async function POST(req: Request) { try {
  const url = new URL(req.url);
  const p = await readTwilioWebhook(req, '/api/webhooks/twilio/voice-menu');
  if (!voiceEnabled() || p.To !== BUSINESS_CONTACT.phone || !/^CA[a-f0-9]{32}$/i.test(p.CallSid || '')) throw new HttpError(503, 'Voice routing is not activated.');
  const auto = url.searchParams.get('auto'), retry = url.searchParams.get('retry') === '1';
  const digit = auto && MENU[auto] ? auto : (p.Digits || '');
  if (!MENU[digit]) {
    if (!retry) return twiml(`<Gather input="dtmf" numDigits="1" timeout="8" action="${SITE}/api/webhooks/twilio/voice-menu?retry=1" method="POST"><Say>Sorry, we didn't get that. To book a move, press 1. For service provider dispatch, press 2. For customer support, press 0.</Say></Gather><Redirect method="POST">${SITE}/api/webhooks/twilio/voice-menu?retry=1</Redirect>`);
    await logCall(p.CallSid, { status: 'likely_spam' });
    return twiml("<Say>We didn't receive a selection. Please visit wont stop moving dot com. Goodbye.</Say><Hangup/>");
  }
  let agentCallSid: string | null = null;
  try { agentCallSid = await ringAgent(p.CallSid, digit); } catch { agentCallSid = null; }
  await logCall(p.CallSid, { choice: MENU[digit].key, status: agentCallSid ? 'ringing' : 'missed', agentCallSid });
  if (!agentCallSid) return twiml(`<Redirect method="POST">${SITE}/api/webhooks/twilio/voice-complete</Redirect>`);
  // Caller waits with hold music and the wait message (#169) until answered or 90 seconds pass.
  return twiml(`<Say>${WAIT_MESSAGE}</Say><Enqueue waitUrl="${SITE}/api/webhooks/twilio/voice-hold" waitUrlMethod="POST" action="${SITE}/api/webhooks/twilio/voice-complete" method="POST">wsm-${p.CallSid}</Enqueue>`);
} catch (error) { return errorResponse(error); } }
