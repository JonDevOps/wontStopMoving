import { FieldValue } from 'firebase-admin/firestore';
import { readTwilioWebhook } from '@/lib/server/twilio-webhook';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { BUSINESS_CONTACT } from '@/lib/business-contact';
import { smsPhoneId } from '@/lib/server/sms-consent';

const rank:Record<string,number>={accepted:0,scheduled:0,queued:1,sending:2,sent:3,failed:4,undelivered:4,delivered:5,read:6};
export async function POST(req:Request){
  try{
    const p=await readTwilioWebhook(req,'/api/webhooks/twilio/status'),id=new URL(req.url).searchParams.get('id');
    if(!id||!/^[a-f0-9]{64}$/.test(id)||!/^SM[a-f0-9]{32}$/i.test(p.MessageSid||'')||!Object.hasOwn(rank,p.MessageStatus))throw new HttpError(400,'Invalid delivery receipt.');
    const db=adminDb(),ref=db.doc(`smsOutbox/${id}`);
    await db.runTransaction(async tx=>{
      const message=(await tx.get(ref)).data();
      if(!message || !['sending','accepted','needs_review'].includes(message.status) || p.To!==message.to || p.From!==BUSINESS_CONTACT.phone || (message.providerMessageId&&message.providerMessageId!==p.MessageSid))throw new HttpError(400,'Receipt does not match a message.');
      if((rank[message.deliveryStatus]??-1)>rank[p.MessageStatus])return;
      tx.update(ref,{providerMessageId:p.MessageSid,deliveryStatus:p.MessageStatus,deliveryUpdatedAt:FieldValue.serverTimestamp(),...(p.ErrorCode?{deliveryErrorCode:p.ErrorCode.slice(0,20)}:{})});
      if(p.ErrorCode==='21610')tx.set(db.doc(`smsSuppressions/${smsPhoneId(message.to)}`),{phone:message.to,optedOut:true,source:'twilio_status',updatedAt:FieldValue.serverTimestamp()});
    });
    return new Response(null,{status:204});
  }catch(error){return errorResponse(error);}
}
