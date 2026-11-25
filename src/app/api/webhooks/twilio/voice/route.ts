import { readTwilioWebhook, twiml, xml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { normalizeSmsPhone } from '@/lib/sms-consent';
import { FieldValue } from 'firebase-admin/firestore';
import { GREETING, SITE, isBlocked, knownCaller, logCall, voiceEnabled } from '@/lib/server/phone';

/**
 * Incoming calls (#182). Blocked numbers are rejected; customers and providers
 * on file skip the menu; everyone else must press a key, which robocallers
 * can't do. Every call is logged in phoneInbox for the call log (#159).
 */
export async function POST(req: Request) { try {
  const p = await readTwilioWebhook(req, '/api/webhooks/twilio/voice');
  if (p.To !== BUSINESS_CONTACT.phone || !/^CA[a-f0-9]{32}$/i.test(p.CallSid || '')) throw new HttpError(400, 'Invalid call.');
  if (!voiceEnabled()) throw new HttpError(503, 'Voice routing is not activated.');
  const phone = normalizeSmsPhone(p.From) || '';
  const base = { kind: 'call', callSid: p.CallSid, phone, callerName: (p.CallerName || '').slice(0, 80), createdAt: FieldValue.serverTimestamp() };
  if (await isBlocked(phone)) { await logCall(p.CallSid, { ...base, status: 'blocked' }); return twiml('<Reject reason="busy"/>'); }
  const known = await knownCaller(phone);
  if (known) {
    const choice = known.role === 'provider' ? '2' : '0';
    await logCall(p.CallSid, { ...base, status: 'menu', knownRole: known.role, knownName: known.name });
    const hello = known.name ? `Welcome back, ${xml(known.name.split(' ')[0])}.` : 'Welcome back.';
    return twiml(`<Say>${GREETING} ${hello}</Say><Redirect method="POST">${SITE}/api/webhooks/twilio/voice-menu?auto=${choice}</Redirect>`);
  }
  await logCall(p.CallSid, { ...base, status: 'menu' });
  return twiml(`<Gather input="dtmf" numDigits="1" timeout="8" action="${SITE}/api/webhooks/twilio/voice-menu" method="POST"><Say>${GREETING} To book a move, press 1. For service provider dispatch, press 2. For customer support, press 0.</Say></Gather><Redirect method="POST">${SITE}/api/webhooks/twilio/voice-menu</Redirect>`);
} catch (error) { return errorResponse(error); } }
