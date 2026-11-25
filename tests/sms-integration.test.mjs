import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import twilio from 'twilio';
import { initializeApp,deleteApp } from 'firebase/app';
import { getAuth,connectAuthEmulator,createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp as initializeAdmin,deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore,Timestamp } from 'firebase-admin/firestore';
import { normalizeSmsPhone,SMS_DISCLOSURE_VERSION,smsSourcePage } from '../src/lib/sms-consent.ts';
const base=process.env.SUPPORT_TEST_BASE_URL;
if(!base?.startsWith('http://127.0.0.1:')||process.env.GCLOUD_PROJECT!=='demo-wsm')throw new Error('Local test server required.');
let app,admin,db,token,uid;
const hash=s=>createHash('sha256').update(s).digest('hex');
const phone='+15555550199',subject=()=>`user:${uid}`,profile=()=>db.doc(`smsConsentProfiles/${hash(subject())}`);
const post=(body,auth=token)=>({method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:JSON.stringify(body)});
const prefs=(choice,extra={})=>fetch(`${base}/api/sms/preferences`,post({phone,smsConsent:choice,smsDisclosureVersion:SMS_DISCLOSURE_VERSION,smsSourcePage:'/contact?private=secret#token',...extra}));
const webhook=(route,params,signed=true)=>{
 const signature=twilio.getExpectedTwilioSignature('wsm-test-webhook-token',`https://wontstopmoving.com${route}`,params);
 return fetch(`${base}${route}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':signed?signature:'invalid'},body:new URLSearchParams(params)});
};
before(async()=>{admin=initializeAdmin({projectId:'demo-wsm'},'sms-integration');db=getFirestore(admin);app=initializeApp({projectId:'demo-wsm',apiKey:'fake'},'sms-integration');const auth=getAuth(app);connectAuthEmulator(auth,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});const user=(await createUserWithEmailAndPassword(auth,`sms-${randomUUID()}@example.com`,'test-only-password')).user;uid=user.uid;await db.doc(`users/${uid}`).set({role:'customer'});token=await user.getIdToken();});
after(async()=>{await deleteApp(app);await deleteAdmin(admin);});

test('normalization and consent evidence exclude sensitive URL parameters',()=>{assert.equal(normalizeSmsPhone('(888) 741-6683'),'+18887416683');assert.equal(normalizeSmsPhone('+44 20 7946 0000'),'+442079460000');assert.equal(normalizeSmsPhone('5551234'),null);assert.equal(normalizeSmsPhone('4155550123 ext 5'),null);assert.equal(smsSourcePage('/contact?token=secret#code'),'https://wontstopmoving.com/contact');assert.equal(smsSourcePage('https://evil.example/a'), 'https://wontstopmoving.com/sms');});

test('public legal and opt-in routes render an optional unchecked checkbox and correct contact links',async()=>{
 for(const path of ['/privacy','/terms','/terms/2026-11-08','/terms/2026-11-18','/terms/2026-11-25','/sms','/contact','/contact.vcf'])assert.equal((await fetch(`${base}${path}`)).status,200,path);
 const privacy=await(await fetch(`${base}/privacy`)).text();assert.ok(privacy.includes('All the above categories exclude text messaging originator opt-in data and consent;'));
 const contact=await(await fetch(`${base}/contact`)).text();assert.ok(contact.includes('tel:+18887416683'));assert.ok(contact.includes('sms-consent-checkbox'));assert.ok(!/<input[^>]*id="sms-consent-checkbox"[^>]*checked/.test(contact));assert.ok(contact.includes('Consent is not a condition of purchase'));assert.ok(contact.includes('/terms#sms')&&contact.includes('/privacy#sms'));
 const vcard=await(await fetch(`${base}/contact.vcf`)).text();assert.ok(vcard.includes('TEL;TYPE=WORK,VOICE:+18887416683'));
});

test('authenticated consent is versioned, private, server-timestamped and decline works without a phone',async()=>{
 assert.equal((await fetch(`${base}/api/sms/preferences`,post({smsConsent:true},''))).status,401);
 assert.equal((await prefs(true,{smsDisclosureVersion:'old'})).status,400);
 assert.equal((await prefs(false,{phone:'not-a-phone'})).status,200);
 assert.equal((await prefs(true)).status,200);
 const data=(await profile().get()).data();assert.equal(data.customerId,uid);assert.equal(data.phone,phone);assert.equal(data.enabled,true);assert.equal(data.disclosureVersion,SMS_DISCLOSURE_VERSION);assert.equal(data.sourcePage,'https://wontstopmoving.com/contact');assert.ok(Math.abs(Date.now()-data.consentedAt.toMillis())<15000);assert.ok((await profile().collection('history').get()).size>=2);
 assert.equal((await prefs(false)).status,200);assert.equal((await profile().get()).data().enabled,false);
 assert.equal((await prefs(true)).status,200);
});

test('signed STOP suppresses every future send, retries do not re-enroll, START requires fresh website consent',async()=>{
 const params={AccountSid:'AC'+'1'.repeat(32),MessageSid:'SM'+'2'.repeat(32),From:phone,To:'+18887416683',Body:'STOP',OptOutType:'STOP'};
 assert.equal((await webhook('/api/webhooks/twilio/sms',params,false)).status,403);
 assert.equal((await webhook('/api/webhooks/twilio/sms',{...params,To:'+18880000000'})).status,400);
 assert.equal((await webhook('/api/webhooks/twilio/sms',params)).status,200);assert.equal((await webhook('/api/webhooks/twilio/sms',params)).status,200);
 assert.equal((await db.doc(`smsSuppressions/${hash(phone)}`).get()).data().optedOut,true);assert.equal((await profile().get()).data().enabled,false);
 assert.equal((await prefs(true)).status,409);
 const before=(await profile().collection('history').get()).size;
 await webhook('/api/webhooks/twilio/sms',{...params,MessageSid:'SM'+'3'.repeat(32),Body:'START',OptOutType:'START'});
 assert.equal((await profile().get()).data().enabled,false);assert.equal((await profile().collection('history').get()).size,before);
 assert.equal((await prefs(true)).status,200);
});

test('delivery callbacks match recipient and message ID, never regress delivered and reject forged receipts',async()=>{
 const id=hash('sms-delivery-test'),messageSid='SM'+'4'.repeat(32);await db.doc(`smsOutbox/${id}`).set({status:'accepted',to:phone,providerMessageId:messageSid,createdAt:Timestamp.now()});
 const p={AccountSid:'AC'+'1'.repeat(32),MessageSid:messageSid,To:phone,From:'+18887416683',MessageStatus:'delivered'};
 assert.equal((await webhook(`/api/webhooks/twilio/status?id=${id}`,p,false)).status,403);
 assert.equal((await webhook(`/api/webhooks/twilio/status?id=${id}`,{...p,To:'+15555550198'})).status,400);
 assert.equal((await webhook(`/api/webhooks/twilio/status?id=${id}`,p)).status,204);
 assert.equal((await webhook(`/api/webhooks/twilio/status?id=${id}`,{...p,MessageStatus:'sent'})).status,204);
 assert.equal((await db.doc(`smsOutbox/${id}`).get()).data().deliveryStatus,'delivered');
});

test('contact form saves opt-in or decline without disclosing consent on support tickets',async()=>{
 const body={name:'Fictional customer',email:`proof-${randomUUID()}@example.com`,phone:'8887416683',subject:'Website consent demonstration',message:'This is a fictional local test of the optional text preference.',smsConsent:true,smsDisclosureVersion:SMS_DISCLOSURE_VERSION,smsSourcePage:'/contact'};
 const r=await fetch(`${base}/api/support`,post(body,''));assert.equal(r.status,201);const {ticketId}=await r.json();const ticket=(await db.doc(`supportTickets/${ticketId}`).get()).data();assert.equal(ticket.smsConsent,undefined);assert.equal((await db.doc(`smsConsentProfiles/${hash(`ticket:${ticketId}`)}`).get()).data().phone,'+18887416683');
 assert.equal((await fetch(`${base}/api/support`,post({...body,email:`decline-${randomUUID()}@example.com`,phone:'',smsConsent:false},''))).status,201);
});

test('voice and administrative phone surfaces fail closed before activation and authorization',async()=>{
 assert.equal((await fetch(`${base}/api/admin/phone`)).status,401);assert.equal((await fetch(`${base}/api/admin/phone`,{headers:{Authorization:`Bearer ${token}`}})).status,403);
 const p={AccountSid:'AC'+'1'.repeat(32),CallSid:'CA'+'5'.repeat(32),From:phone,To:'+18887416683'};
 assert.equal((await webhook('/api/webhooks/twilio/voice',p)).status,503);
});
