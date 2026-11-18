import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { getSmsPreferences, smsAllowed, smsPhoneId, smsSubjectId } from './sms-consent';
import { BUSINESS_CONTACT } from '../business-contact';

export function moveSmsConfigured() {
  return process.env.NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED === 'true' && process.env.TWILIO_TOLL_FREE_VERIFIED === 'true' && /^AC[a-f0-9]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID || '') && !!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER === BUSINESS_CONTACT.phone && !/placeholder/i.test(process.env.TWILIO_AUTH_TOKEN || '');
}

/** Private consent lives outside provider-readable jobs. Legacy booleans never enroll anyone. */
export async function customerTextPhone(uid: string) { const p = await getSmsPreferences(uid); return p.enabled ? p.phone : ''; }
export async function queueReleaseText(jobId: string, phone: string, body: string) { return queueMoveText(`release:${jobId}`, jobId, phone, body); }
export async function queueMoveText(key: string, jobId: string, phone: string, body: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return 'invalid_number';
  if (!body || body.length > 1600) return 'invalid_body';
  const db = adminDb(), id = createHash('sha256').update(key).digest('hex'), ref = db.doc(`smsOutbox/${id}`);
  await db.runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.create(ref, { key, jobId, to: phone, body, status: 'pending', createdAt: FieldValue.serverTimestamp() }); });
  return deliverMoveText(id);
}

export async function deliverMoveText(id: string) {
  const db = adminDb(), ref = db.doc(`smsOutbox/${id}`);
  if (!moveSmsConfigured()) return 'pending_configuration';
  const message = await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (data?.status !== 'pending') return null;
    const job = data.jobId ? (await tx.get(db.doc(`jobs/${data.jobId}`))).data() : undefined;
    let consent = false;
    if (job?.paymentStatus === 'paid' && job.status !== 'cancelled') {
      if (String(data.key || '').startsWith('provider-')) {
        // Include the assigned UID in the key. One consenting provider cannot authorize another provider's message.
        const uid = String(data.key).split(':').at(-1)!;
        consent = (job.providerIds || []).includes(uid) && await smsAllowed(tx, `user:${uid}`, data.to);
        if (String(data.key).startsWith('provider-assigned:') && job.status === 'completed') consent = false;
      } else {
        consent = !!job.customerId && await smsAllowed(tx, `user:${job.customerId}`, data.to);
        if (!String(data.key || '').startsWith('review:') && job.status === 'completed') consent = false;
        if (String(data.key || '').startsWith('review:') && (job.status !== 'completed' || !job.releaseConfirmedAt)) consent = false;
      }
    }
    if (['quote','support','consent'].includes(data.referenceKind)) {
      const collection = data.referenceKind === 'quote' ? 'quotes' : data.referenceKind === 'support' ? 'supportTickets' : 'smsConsentProfiles';
      const record = (await tx.get(db.doc(`${collection}/${data.referenceId}`))).data();
      const validSubject = record && (data.referenceKind === 'quote' ? data.subject === `user:${record.customerId}` && record.status !== 'expired' : data.referenceKind === 'support' ? data.subject === `ticket:${data.referenceId}` : data.referenceId === smsSubjectId(data.subject));
      consent = !!validSubject && await smsAllowed(tx,data.subject,data.to);
    }
    // Never release old queued texts in bulk after a delayed verification or configuration change.
    if (!data.createdAt?.toMillis || Date.now()-data.createdAt.toMillis()>86400000) consent=false;
    const now = Date.now(), day = new Date(now).toISOString().slice(0,10), hour = Math.floor(now/3600000);
    const daily = db.doc(`smsSendLimits/day-${day}`), recipient = db.doc(`smsSendLimits/${smsPhoneId(data.to)}-${hour}`);
    const [dailyCount, phoneCount] = await Promise.all([tx.get(daily),tx.get(recipient)]);
    if (!consent) { tx.update(ref,{status:'cancelled',reason:'consent_or_job_changed'}); return null; }
    // Reservations survive process restarts; no unbounded paid sends from one recipient or job loop.
    if ((dailyCount.data()?.count || 0) >= 1000 || (phoneCount.data()?.count || 0) >= 20) return null;
    tx.set(daily,{count:(dailyCount.data()?.count || 0)+1});tx.set(recipient,{count:(phoneCount.data()?.count || 0)+1});
    tx.update(ref,{status:'sending',attemptedAt:FieldValue.serverTimestamp()});return data;
  });
  if (!message) return (await ref.get()).data()?.status;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const params = new URLSearchParams({To:message.to,From:BUSINESS_CONTACT.phone,Body:message.body,StatusCallback:`https://wontstopmoving.com/api/webhooks/twilio/status?id=${id}`});
    if (/^MG[a-f0-9]{32}$/i.test(process.env.TWILIO_MESSAGING_SERVICE_SID || '')) params.set('MessagingServiceSid',process.env.TWILIO_MESSAGING_SERVICE_SID!);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
    const result = await response.json();
    if (!response.ok || !/^SM[a-f0-9]{32}$/i.test(result.sid || '')) {
      if (result.code === 21610) await db.doc(`smsSuppressions/${smsPhoneId(message.to)}`).set({phone:message.to,optedOut:true,source:'twilio_21610',updatedAt:FieldValue.serverTimestamp()});
      throw new Error('SMS_NOT_ACCEPTED');
    }
    await ref.update({status:'accepted',providerMessageId:result.sid,acceptedAt:FieldValue.serverTimestamp()});return 'accepted';
  } catch { await ref.update({status:'needs_review',failureCode:'SMS_DELIVERY_UNCONFIRMED'}); return 'needs_review'; }
}

/** Internal lifecycle events only: no public endpoint accepts arbitrary recipient/body pairs. */
export async function queueInformationalText(key: string, subject: string, reference: {kind:'quote'|'support'|'consent';id:string}, body: string) {
  const db=adminDb(),p=(await db.doc(`smsConsentProfiles/${smsSubjectId(subject)}`).get()).data();
  if(!p?.enabled || !p.phone)return 'not_requested';
  if(!body || body.length>1600)return 'invalid_body';
  const id=createHash('sha256').update(key).digest('hex'),ref=db.doc(`smsOutbox/${id}`);
  await db.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,{key,subject,referenceKind:reference.kind,referenceId:reference.id,to:p.phone,body,status:'pending',createdAt:FieldValue.serverTimestamp()});});
  return deliverMoveText(id);
}

export async function queueConsentConfirmation(subject:string){
  const id=smsSubjectId(subject),p=(await adminDb().doc(`smsConsentProfiles/${id}`).get()).data();
  if(!p?.enabled || !p.updatedAt?.toMillis)return 'not_requested';
  return queueInformationalText(`consent:${id}:${p.updatedAt.toMillis()}`,subject,{kind:'consent',id},'WontStopMoving: You opted in to informational moving texts. Message frequency varies. Msg/data rates may apply. Reply HELP for help or STOP to opt out.');
}
