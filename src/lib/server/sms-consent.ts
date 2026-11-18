import { createHash } from 'node:crypto';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { HttpError } from './auth';
import { normalizeSmsPhone, SMS_DISCLOSURE_VERSION, SMS_PURPOSE, SMS_DISCLOSURE, PROVIDER_SMS_DISCLOSURE, smsSourcePage } from '../sms-consent';

export const smsPhoneId = (phone: string) => createHash('sha256').update(phone).digest('hex');
export const smsSubjectId = (subject: string) => createHash('sha256').update(subject).digest('hex');
export type ConsentInput = { subject: string; customerId?: string; phone: unknown; consent: boolean; version?: unknown; source: string; sourcePage?: unknown; provider?: boolean; eventId?: string };

/** Call after all other transaction reads and before any other writes. Server-only evidence. */
export async function writeSmsConsent(tx: Transaction, input: ConsentInput) {
  const phone = normalizeSmsPhone(input.phone);
  if (input.consent && (!phone || input.version !== SMS_DISCLOSURE_VERSION)) throw new HttpError(400, 'Enter a valid mobile number and review the current optional SMS disclosure.');
  const db = adminDb(), ref = db.doc(`smsConsentProfiles/${smsSubjectId(input.subject)}`);
  const prior = (await tx.get(ref)).data();
  const effectivePhone = phone || prior?.phone || '';
  const suppression = effectivePhone ? (await tx.get(db.doc(`smsSuppressions/${smsPhoneId(effectivePhone)}`))).data() : undefined;
  if (input.consent && suppression?.optedOut === true) throw new HttpError(409, 'This number opted out by text. Reply START to our number, then choose SMS updates again here. You can still continue without SMS.');
  // A retry with a deterministic event ID must never re-enroll someone after STOP.
  const history = input.eventId ? ref.collection('history').doc(smsSubjectId(input.eventId)) : ref.collection('history').doc();
  if (input.eventId && (await tx.get(history)).exists) return;
  const data = { subject: input.subject, customerId: input.customerId || null, phone: effectivePhone, consentStatus: input.consent ? 'granted' : 'declined', enabled: input.consent,
    purpose: SMS_PURPOSE, disclosureVersion: SMS_DISCLOSURE_VERSION, disclosure: input.provider ? PROVIDER_SMS_DISCLOSURE : SMS_DISCLOSURE,
    source: input.source, sourcePage: smsSourcePage(input.sourcePage), provider: input.provider === true,
    consentedAt: input.consent ? FieldValue.serverTimestamp() : prior?.consentedAt || null,
    optedOut: !input.consent, optedOutAt: input.consent ? null : FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  tx.set(ref, data);
  tx.create(history, data);
}

export async function saveSmsConsent(input: ConsentInput) { await adminDb().runTransaction(tx => writeSmsConsent(tx, input)); }

export async function getSmsPreferences(uid: string) {
  const p = (await adminDb().doc(`smsConsentProfiles/${smsSubjectId(`user:${uid}`)}`).get()).data();
  if (!p) return { phone: '', enabled: false, optedOut: false };
  const blocked = p.phone && (await adminDb().doc(`smsSuppressions/${smsPhoneId(p.phone)}`).get()).data()?.optedOut === true;
  return { phone: p.phone || '', enabled: p.enabled === true && !blocked, optedOut: !!blocked || p.optedOut === true };
}

/** Re-read consent and global STOP suppression in the dispatch transaction. No legacy booleans qualify. */
export async function smsAllowed(tx: Transaction, subject: string, phone: string) {
  const db = adminDb();
  const [profile, suppression] = await Promise.all([tx.get(db.doc(`smsConsentProfiles/${smsSubjectId(subject)}`)), tx.get(db.doc(`smsSuppressions/${smsPhoneId(phone)}`))]);
  const p = profile.data();
  return p?.enabled === true && p.consentStatus === 'granted' && p.phone === phone && p.disclosureVersion === SMS_DISCLOSURE_VERSION && suppression.data()?.optedOut !== true;
}
