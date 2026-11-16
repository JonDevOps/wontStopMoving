import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

export function moveSmsConfigured() {
  return /^AC[a-f0-9]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID || '') && !!process.env.TWILIO_AUTH_TOKEN && /^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_FROM_NUMBER || '') && !/placeholder/i.test(process.env.TWILIO_AUTH_TOKEN || '');
}

/** Transactional texts only, to the number explicitly consented to at checkout. */
export async function queueReleaseText(jobId: string, phone: string, body: string) {
  const db = adminDb(), id = createHash('sha256').update(`release:${jobId}`).digest('hex'), ref = db.doc(`smsOutbox/${id}`);
  await db.runTransaction(async tx => {
    if (!(await tx.get(ref)).exists) tx.create(ref, { jobId, to: phone, body, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  });
  if (!moveSmsConfigured()) return 'pending_configuration';
  const message = await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (data?.status !== 'pending') return null;
    tx.update(ref, { status: 'sending', attemptedAt: FieldValue.serverTimestamp() });
    return data;
  });
  if (!message) return (await ref.get()).data()?.status;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: message.to, From: process.env.TWILIO_FROM_NUMBER!, Body: message.body }),
    });
    if (!response.ok) throw new Error('SMS_REJECTED');
    const result = await response.json();
    if (!result.sid) throw new Error('SMS_NO_RECEIPT');
    await ref.update({ status: 'accepted', providerMessageId: result.sid, acceptedAt: FieldValue.serverTimestamp() });
    return 'accepted';
  } catch {
    await ref.update({ status: 'needs_review', failureCode: 'SMS_DELIVERY_UNCONFIRMED' });
    return 'needs_review';
  }
}
