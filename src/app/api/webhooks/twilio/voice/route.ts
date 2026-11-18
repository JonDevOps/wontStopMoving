import { readTwilioWebhook, twiml, xml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { normalizeSmsPhone } from '@/lib/sms-consent';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';

export async function POST(req:Request){try{
  const p=await readTwilioWebhook(req,'/api/webhooks/twilio/voice');
  if(p.To!==BUSINESS_CONTACT.phone || !/^CA[a-f0-9]{32}$/i.test(p.CallSid||''))throw new HttpError(400,'Invalid call.');
  if(process.env.TWILIO_VOICE_ENABLED!=='true')throw new HttpError(503,'Voice routing is not activated.');
  const ref=adminDb().doc(`phoneInbox/${p.CallSid}`);
  await adminDb().runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,{kind:'call',callSid:p.CallSid,phone:normalizeSmsPhone(p.From)||'',status:'new',createdAt:FieldValue.serverTimestamp()});});
  const forward=normalizeSmsPhone(process.env.TWILIO_VOICE_FORWARD_TO);
  const greeting='<Say>Thank you for calling Wont Stop Moving.</Say>';
  if(forward&&forward!==BUSINESS_CONTACT.phone)return twiml(`${greeting}<Dial callerId="${BUSINESS_CONTACT.phone}" timeout="20" timeLimit="1800" action="${BUSINESS_CONTACT.website}/api/webhooks/twilio/voice-complete" method="POST"><Number>${xml(forward)}</Number></Dial>`);
  return twiml(`${greeting}<Redirect method="POST">${BUSINESS_CONTACT.website}/api/webhooks/twilio/voice-complete</Redirect>`);
}catch(error){return errorResponse(error);}}
