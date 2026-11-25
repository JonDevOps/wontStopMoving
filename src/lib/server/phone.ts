import twilio from 'twilio';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { BUSINESS_CONTACT } from '../business-contact';
import { normalizeSmsPhone } from '../sms-consent';

/**
 * Business phone menu (#182, #169, #159). Every call is logged in
 * phoneInbox/{CallSid}; the admin phone page is the call log.
 */
export const SITE = BUSINESS_CONTACT.website;
export const HOLD_LIMIT_SECONDS = 90;
export const MENU: Record<string, { key: string; label: string; spoken: string }> = {
  '1': { key: 'booking', label: 'Book a move', spoken: 'booking a move' },
  '2': { key: 'dispatch', label: 'Provider dispatch', spoken: 'provider dispatch' },
  '0': { key: 'support', label: 'Customer support', spoken: 'customer support' },
};
export const GREETING = 'Thank you for calling Wont Stop Moving.';
export const WAIT_MESSAGE = 'Your call is important to us. Please remain on the line for the next available representative.';

export const voiceEnabled = () => process.env.TWILIO_VOICE_ENABLED === 'true';
export const agentNumber = () => {
  const n = normalizeSmsPhone(process.env.TWILIO_VOICE_FORWARD_TO);
  return n && n !== BUSINESS_CONTACT.phone ? n : null;
};
const digitsOf = (phone: string) => phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
/** "4 1 5, 5 5 5, 0 1 0 0" so Twilio reads the caller's number digit by digit. */
export const spokenNumber = (phone: string) => {
  const d = digitsOf(phone);
  return d.length === 10 ? `${d.slice(0, 3).split('').join(' ')}, ${d.slice(3, 6).split('').join(' ')}, ${d.slice(6).split('').join(' ')}` : 'an unknown number';
};

/** Numbers an admin blocked from the call log. */
export async function isBlocked(phone: string) {
  if (!phone) return false;
  return (await adminDb().doc(`phoneBlocklist/${digitsOf(phone)}`).get()).exists;
}

/** Customers and providers on file skip the menu (caller-ID allowlist). */
export async function knownCaller(phone: string): Promise<{ role: string; name: string } | null> {
  if (!phone) return null;
  const d = digitsOf(phone), users = adminDb().collection('users');
  for (const value of [...new Set([phone, d, `+1${d}`])]) {
    const snap = await users.where('phone', '==', value).limit(1).get();
    if (!snap.empty) { const u = snap.docs[0].data(); return { role: String(u.role || 'customer'), name: String(u.name || '') }; }
  }
  return null;
}

export async function logCall(callSid: string, data: Record<string, unknown>) {
  await adminDb().doc(`phoneInbox/${callSid}`).set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Rings the owner's phone; the whisper on answer asks them to press 1 to take the call. */
export async function ringAgent(callSid: string, choice: string) {
  const to = agentNumber(), sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  if (!to || !sid || !token) return null;
  const call = await twilio(sid, token).calls.create({
    to, from: BUSINESS_CONTACT.phone, timeout: HOLD_LIMIT_SECONDS - 5,
    url: `${SITE}/api/webhooks/twilio/voice-agent?call=${encodeURIComponent(callSid)}&choice=${encodeURIComponent(choice)}`,
    method: 'POST',
  });
  return call.sid;
}
