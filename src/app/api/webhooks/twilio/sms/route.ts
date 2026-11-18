import { FieldValue } from 'firebase-admin/firestore';
import { readTwilioWebhook, twiml, xml } from '@/lib/server/twilio-webhook';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { smsPhoneId } from '@/lib/server/sms-consent';
import { normalizeSmsPhone } from '@/lib/sms-consent';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { moveSmsConfigured } from '@/lib/server/move-sms';

export const runtime='nodejs';
export async function POST(req:Request) {
  try {
    const p=await readTwilioWebhook(req,'/api/webhooks/twilio/sms');
    const phone=normalizeSmsPhone(p.From);
    if(!phone || p.To!==BUSINESS_CONTACT.phone || !/^(SM|MM)[a-f0-9]{32}$/i.test(p.MessageSid||''))throw new HttpError(400,'Invalid message.');
    const keyword=(p.OptOutType||p.Body||'').trim().toUpperCase();
    const stop=['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(keyword);
    const start=['START','UNSTOP'].includes(keyword),help=['HELP','INFO'].includes(keyword);
    const db=adminDb(),ref=db.doc(`twilioWebhookEvents/inbound-${p.MessageSid}`),suppression=db.doc(`smsSuppressions/${smsPhoneId(phone)}`);
    const fresh=await db.runTransaction(async tx=>{
      if((await tx.get(ref)).exists)return false;
      const previous=(await tx.get(suppression)).data();
      const profiles=stop ? await tx.get(db.collection('smsConsentProfiles').where('phone','==',phone).limit(200)) : null;
      tx.create(ref,{kind:'inbound_sms',messageSid:p.MessageSid,phone,keyword:stop?'STOP':start?'START':help?'HELP':'support',receivedAt:FieldValue.serverTimestamp()});
      if(stop||start)tx.set(suppression,{phone,optedOut:stop,source:'twilio_inbound',messageSid:p.MessageSid,updatedAt:FieldValue.serverTimestamp(),...(stop?{optedOutAt:FieldValue.serverTimestamp()}:{optedOutAt:previous?.optedOutAt||null})});
      // Global suppression covers all records immediately, even beyond this bounded mirror update.
      if(profiles)for(const profile of profiles.docs){const update={enabled:false,consentStatus:'revoked',optedOut:true,optedOutAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),source:'twilio_stop'};tx.update(profile.ref,update);tx.create(profile.ref.collection('history').doc(`stop-${p.MessageSid}`),{...update,phone,messageSid:p.MessageSid});}
      if(!stop&&!start&&!help)tx.create(db.doc(`phoneInbox/${p.MessageSid}`),{kind:'sms',phone,body:String(p.Body||'').slice(0,1600),mediaCount:Number(p.NumMedia||0),status:'new',createdAt:FieldValue.serverTimestamp()});
      return true;
    });
    // Advanced Opt-Out and toll-free carriers already send keyword confirmations. Do not duplicate them.
    if(!fresh||p.OptOutType||stop||start||!moveSmsConfigured())return twiml();
    if(help)return twiml(`<Message>${xml(`WontStopMoving: Help at ${BUSINESS_CONTACT.email} or ${BUSINESS_CONTACT.phoneNumeric}. Message frequency varies. Msg/data rates may apply. Reply STOP to opt out.`)}</Message>`);
    return twiml();
  }catch(error){return errorResponse(error);}
}
