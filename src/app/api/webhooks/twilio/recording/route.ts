import { FieldValue } from 'firebase-admin/firestore';
import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { adminDb } from '@/lib/server/firebase-admin';
export async function POST(req:Request){try{
  const p=await readTwilioWebhook(req,'/api/webhooks/twilio/recording');
  if(process.env.TWILIO_VOICE_ENABLED!=='true'||process.env.TWILIO_VOICEMAIL_ENABLED!=='true'||!/^RE[a-f0-9]{32}$/i.test(p.RecordingSid||'')||!/^CA[a-f0-9]{32}$/i.test(p.CallSid||''))throw new HttpError(400,'Recording is not enabled.');
  // Keep only IDs and duration. Audio stays protected in Twilio; no public URL or automatic transcription.
  const ref=adminDb().doc(`phoneRecordings/${p.RecordingSid}`);
  await adminDb().runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,{recordingSid:p.RecordingSid,callSid:p.CallSid,duration:Math.min(120,Number(p.RecordingDuration)||0),createdAt:FieldValue.serverTimestamp(),status:'new'});});
  return twiml('<Say>Thank you for your message.</Say><Hangup/>');
}catch(error){return errorResponse(error);}}
