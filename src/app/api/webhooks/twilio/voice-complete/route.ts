import { readTwilioWebhook, twiml } from '@/lib/server/twilio-webhook';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
export async function POST(req:Request){try{
  const p=await readTwilioWebhook(req,'/api/webhooks/twilio/voice-complete');
  if(process.env.TWILIO_VOICE_ENABLED!=='true'||p.To!==BUSINESS_CONTACT.phone)throw new HttpError(503,'Voice routing is not activated.');
  if(p.DialCallStatus==='completed')return twiml('<Hangup/>');
  // Recording must be explicitly enabled by the owner after reviewing the disclosure and access policy.
  if(process.env.TWILIO_VOICEMAIL_ENABLED==='true')return twiml(`<Say>We cannot answer right now. To leave a recorded voicemail, speak after the beep. Your message will be recorded for our support team. Please do not include payment card information or payment codes. You may hang up and email support at wont stop moving dot com instead.</Say><Record maxLength="120" timeout="5" playBeep="true" transcribe="false" action="${BUSINESS_CONTACT.website}/api/webhooks/twilio/recording" method="POST" recordingStatusCallback="${BUSINESS_CONTACT.website}/api/webhooks/twilio/recording" recordingStatusCallbackMethod="POST"/><Hangup/>`);
  return twiml('<Say>We cannot answer right now. Please visit wont stop moving dot com or email support at wont stop moving dot com. Thank you.</Say><Hangup/>');
}catch(error){return errorResponse(error);}}
