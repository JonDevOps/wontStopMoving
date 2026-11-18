import twilio from 'twilio';
import { HttpError } from './auth';
import { BUSINESS_CONTACT } from '../business-contact';

/** Fixed public origin prevents proxy/Host-header signature confusion. No JSON webhooks are accepted. */
export async function readTwilioWebhook(req: Request, path: string) {
  const token = process.env.TWILIO_AUTH_TOKEN, sid = process.env.TWILIO_ACCOUNT_SID;
  if (!token || !sid || /placeholder/i.test(token)) throw new HttpError(503,'Phone integration is not configured.');
  if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new HttpError(415,'Expected form encoding.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400,'Missing request body.');
  const chunks: Uint8Array[] = [];let size=0;
  while (true) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32000){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value); }
  const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  const params: Record<string,string> = {};
  for (const [key,value] of form) {if(Object.hasOwn(params,key))throw new HttpError(400,'Duplicate parameter.');params[key]=value;}
  const query = new URL(req.url).search;
  const url = `${BUSINESS_CONTACT.website}${path}${query}`;
  if (!twilio.validateRequest(token,req.headers.get('x-twilio-signature') || '',url,params) || params.AccountSid !== sid) throw new HttpError(403,'Invalid phone-service signature.');
  return params;
}
export function twiml(content='') {return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`,{headers:{'Content-Type':'text/xml; charset=utf-8','Cache-Control':'no-store'}});}
export function xml(value:string){return value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));}
