import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as contact from '../src/lib/business-contact.ts';
import * as consentShared from '../src/lib/sms-consent.ts';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { moneyOperation } from '../src/lib/server/money-operation.ts';
import { providerShareCents, tipShareCents, moverCartSchema } from '../src/lib/mover-cart.ts';
import { validProviderPricing } from '../src/lib/mover-pricing.ts';

if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-wsm') throw new Error('Demo emulator required.');
process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED = 'true';
const app = initializeApp({ projectId: 'demo-wsm' }, 'marketplace-money-tests'), db = getFirestore(app);
before(async () => {
  for (const name of ['jobs','providers','jobSecrets','moverOrders','moveTips','moneyOperations','providerSmsPreferences','smsOutbox']) {
    const docs = await db.collection(name).get();
    for (const doc of docs.docs.filter(doc => doc.id.includes('money-'))) await db.recursiveDelete(doc.ref);
  }
});
after(() => deleteApp(app));
const require = createRequire(import.meta.url);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
// Execute the real server modules with an in-memory Stripe boundary. No Stripe
// HTTP calls, live keys, emails or SMS are used by these accounting tests.
function load(file, mocks) {
  const source = readFileSync(new URL(`../src/lib/server/${file}.ts`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  runInThisContext(`(function(require,module,exports){${output}\n})`)(id => id in mocks ? mocks[id] : ['../business-contact','@/lib/business-contact'].includes(id) ? contact : id==='../sms-consent' ? consentShared : id==='./sms-consent' ? load('sms-consent',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock}) : id.startsWith('.') || id.startsWith('@/') ? (() => { throw new Error(`Unmocked dependency ${id}`); })() : require(id), loaded, loaded.exports);
  return loaded.exports;
}
const authMock = { HttpError, isId: value => typeof value === 'string' && /^[\w-]+$/.test(value), stripeConfigured: () => true, requireStripe: () => {} };
function fakeStripe() {
  const transfers = new Map(), refunds = new Map(), sessions = new Map();
  const record = (map, prefix, params, options) => { if (!map.has(options.idempotencyKey)) map.set(options.idempotencyKey, { id: `${prefix}_${map.size}`, status: 'succeeded', params }); return Promise.resolve(map.get(options.idempotencyKey)); };
  return { transfersMade: transfers, refundsMade: refunds, sessionsMade: sessions,
    v2: { core: { accounts: { retrieve: async id => ({ id, configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } } }) } } },
    paymentIntents: { retrieve: async () => ({ status: 'succeeded', currency: 'usd', latest_charge: { id: 'ch_demo_shared', amount: 100000, amount_refunded: 0, refunded: false, disputed: false } }) },
    transfers: { create: (params, options) => { if (params.transfer_group) throw new Error('A source charge already has its order transfer group'); return record(transfers, 'tr', params, options); } },
    refunds: { create: (params, options) => record(refunds, 're', params, options) },
    checkout: { sessions: { create: (params, options) => record(sessions, 'cs', params, options).then(result => ({...result,url:'https://checkout.stripe.com/c/pay/demo'})) } },
  };
}
function benefits(stripe) { return load('move-benefits', { '@/lib/stripe': {stripe}, './firebase-admin': {adminDb:()=>db}, './auth': authMock, './money-operation': {moneyOperation}, '../mover-cart': { REVIEW_REFUND_CENTS:500,tipShareCents } }); }

test('minimum booking and separate tip allocation use integer cents', () => {
  assert.equal(providerShareCents(9000),7650);
  assert.equal(9000-providerShareCents(9000)-500,850);
  assert.equal(tipShareCents(2000),1800);
  assert.equal(tipShareCents(101),91);
});

test('job and review texts follow consent and lifecycle events without leaking payment codes', async () => {
  const sms=load('move-sms',{'./firebase-admin':{adminDb:()=>db}});
  const notices=load('notifications',{'./firebase-admin':{adminDb:()=>db},'../custom-quotes':{},'./move-sms':sms,'./email-provider':{emailProviderConfigured:()=>false},'./email-outbox':{deliverEmail:async()=> 'pending_configuration'}});
  const id='money-sms-job', uid='money-sms-provider', customerId='money-sms-customer';
  const consent=load('sms-consent',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock});
  await consent.saveSmsConsent({subject:`user:${customerId}`,customerId,phone:'+15555550123',consent:true,version:consentShared.SMS_DISCLOSURE_VERSION,source:'test'});
  await db.doc(`jobs/${id}`).set({paymentStatus:'paid',status:'confirmed',moveDate:'2027-12-15',service:'loading',customerId,providerIds:[uid],smsConsent:true,notificationPhone:'+15555550123',reviewRefundEligible:true});
  await notices.notifyProviderTexts(id,'assigned');
  assert.equal((await db.collection('smsOutbox').where('jobId','==',id).get()).size,0);
  await consent.saveSmsConsent({subject:`user:${uid}`,customerId:uid,phone:'+15555550124',consent:true,version:consentShared.SMS_DISCLOSURE_VERSION,source:'test',provider:true});
  await notices.notifyProviderTexts(id,'assigned'); await notices.notifyProviderTexts(id,'assigned');
  await notices.notifyReviewText(id);
  assert.equal((await db.collection('smsOutbox').where('jobId','==',id).get()).size,1);
  await db.doc(`jobs/${id}`).update({status:'completed',releaseConfirmedAt:Timestamp.now(),payoutStatus:'needs_manual_payout'});
  await notices.notifyCompletedJobTexts(id); await notices.notifyCompletedJobTexts(id);
  const texts=(await db.collection('smsOutbox').where('jobId','==',id).get()).docs.map(doc=>doc.data());
  assert.equal(texts.length,3);
  assert.ok(texts.some(text=>text.to==='+15555550123' && text.body.includes(`/dashboard/customer/moves/${id}`) && text.body.includes('Any honest star rating')));
  assert.ok(texts.some(text=>text.to==='+15555550124' && text.body.includes('awaiting processing')));
  assert.ok(texts.every(text=>!text.body.includes('123456')));
});

test('cart rejects one-hour, invalid dates, duplicate items and unsupported services', () => {
  const item = { id:'line-1', providerId:'crew',hours:2,moveDate:'2027-12-15',service:'loading',preferredStartTime:'morning',pickupAddress:'Synthetic pickup',dropoffAddress:'Synthetic dropoff',region:'az',city:'queen-creek',quotedRate:45 };
  assert.equal(moverCartSchema.safeParse([item]).success,true);
  for (const change of [{hours:1},{hours:2.5},{moveDate:'2027-02-30'},{service:'both'}]) assert.equal(moverCartSchema.safeParse([{...item,...change}]).success,false);
  assert.equal(moverCartSchema.safeParse([item,item]).success,false);
});

test('cart checkout reprices on the server, rejects stale rates and checks live recipient capability', async () => {
  const stripe=fakeStripe();
  const coverage=load('mover-coverage', Object.fromEntries(['zip-cities','zip-latlng','canada-city-centers'].map(name => [`@/data/${name}.json`,{default:JSON.parse(readFileSync(new URL(`../src/data/${name}.json`,import.meta.url),'utf8'))}])));
  const checkout=load('mover-checkout', {'@/lib/stripe':{stripe},'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./terms':{requireCurrentTerms:()=>{},bookingTermsAcceptance:()=>({accepted:true})},'../mover-cart':{moverCartSchema,providerShareCents},'../mover-pricing':{validProviderPricing},'./mover-locations':{moverCity:()=>({city:'Queen Creek'})},'./mover-coverage':coverage});
  process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED = 'false';
  try {
    await assert.rejects(() => checkout.createMoverCheckout('money-customer', undefined, {}, 'https://wontstopmoving.com'), error => error.status === 503);
    assert.equal(stripe.sessionsMade.size, 0);
  } finally { process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED = 'true'; }
  const ref=db.doc('providers/money-checkout-crew');
  await ref.set({status:'approved',hourlyRate:45,minimumHours:2,services:['loading'],stripeOnboardingComplete:true,stripeAccountId:'acct_checkout_demo',businessName:'Checkout crew',serviceAreaCities:['az/queen-creek']});
  const body={requestId:'money-checkout-request-1234',items:[{id:'item-1',providerId:ref.id,hours:2,moveDate:'2027-12-15',service:'loading',preferredStartTime:'morning',pickupAddress:'Synthetic pickup',dropoffAddress:'Synthetic dropoff',region:'az',city:'queen-creek',quotedRate:45,price:1}]};
  await checkout.createMoverCheckout('money-customer',undefined,body,'https://wontstopmoving.com');
  await checkout.createMoverCheckout('money-customer',undefined,body,'https://wontstopmoving.com');
  assert.equal(stripe.sessionsMade.size,1);
  assert.equal([...stripe.sessionsMade.values()][0].params.line_items[0].price_data.unit_amount,9000);
  await ref.update({serviceAreaCities:[]});
  await assert.rejects(()=>checkout.createMoverCheckout('money-customer',undefined,{...body,requestId:'money-outside-coverage'},'https://wontstopmoving.com'), error => error.status===409);
  await ref.update({serviceAreaCities:['az/queen-creek'],hourlyRate:46});
  await assert.rejects(()=>checkout.createMoverCheckout('money-customer',undefined,body,'https://wontstopmoving.com'));
  await ref.update({hourlyRate:44});
  await assert.rejects(()=>checkout.createMoverCheckout('money-customer',undefined,body,'https://wontstopmoving.com'));
  await ref.update({hourlyRate:45});
  stripe.v2.core.accounts.retrieve=async()=>({configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'restricted'}}}}}});
  await assert.rejects(()=>checkout.createMoverCheckout('money-customer',undefined,{...body,requestId:'money-checkout-request-restricted'},'https://wontstopmoving.com'));
  assert.equal(stripe.sessionsMade.size,1);
});

test('paid cart allocates each crew once, with distinct private codes and immutable totals', async () => {
  const notices = [], id='money-order';
  const lifecycle = load('mover-orders', { './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{notifyPaidJob:async id=>notices.push(id)} });
  const items = [0,1].map(index => ({jobId:`money-cart-job-${index}`,providerId:`money-crew-${index}`,providerName:`Crew ${index}`,totalCents:index ? 13000 : 9000,providerPayoutCents:index ? 11050:7650,hourlyRate:index ? 65:45,payoutAccountId:`acct_demo_${index}`,moveDate:'2027-12-15',service:index ? 'unloading':'loading',preferredStartTime:'morning',pickupAddress:'Synthetic pickup',dropoffAddress:'Synthetic dropoff',hours:2}));
  await db.doc(`moverOrders/${id}`).set({customerId:'money-customer',checkoutSessionId:'cs_money_cart',totalCents:22000,items,paymentStatus:'pending',smsConsent:false,termsAcceptance:{accepted:true}});
  const session={id:'cs_money_cart',payment_status:'paid',currency:'usd',amount_total:22000,payment_intent:'pi_money_shared',metadata:{flow:'mover_cart',orderId:id,customerId:'money-customer'}};
  assert.equal((await lifecycle.confirmMoverOrder({...session,payment_status:'unpaid'})).jobId,null);
  await assert.rejects(()=>lifecycle.confirmMoverOrder({...session,amount_total:1}));
  await Promise.all([lifecycle.confirmMoverOrder(session),lifecycle.confirmMoverOrder(session)]);
  const secrets = await Promise.all(items.map(item => db.doc(`jobSecrets/${item.jobId}`).get()));
  assert.notEqual(secrets[0].data().releaseCode,secrets[1].data().releaseCode);
  const first=(await db.doc('jobs/money-cart-job-0').get()).data();
  assert.equal(first.amountPaid,90); assert.equal(first.providerPayoutCents,7650); assert.equal(first.platformFeeCents,1350);
  assert.equal(first.releaseCode,undefined);
  await db.doc('jobs/money-cart-job-0').update({status:'completed'});
  await lifecycle.confirmMoverOrder(session);
  assert.equal((await db.doc('jobs/money-cart-job-0').get()).data().status,'completed');
});

test('durable money requests freeze parameters and stop ambiguous retries after 23 hours', async () => {
  let effects=0; const sent=new Map();
  const perform=async (params,key)=>{ if(!sent.has(key)) {effects++;sent.set(key,{id:'tr_money_once',status:'succeeded',params});} return sent.get(key); };
  await Promise.all([moneyOperation(db,'money-idempotency',{amount:7650},perform),moneyOperation(db,'money-idempotency',{amount:1},perform)]);
  assert.equal(effects,1);
  const saved=(await db.doc('moneyOperations/money-idempotency').get()).data();
  const replay=await moneyOperation(db,'money-idempotency',{amount:1000000},perform);
  assert.equal(replay.id,'tr_money_once'); assert.equal(effects,1); assert.ok([1,7650].includes(saved.request.amount));
  await db.doc('moneyOperations/money-stale').set({status:'processing',startedAt:Timestamp.fromMillis(Date.now()-24*3600000),request:{amount:7650}});
  await assert.rejects(()=>moneyOperation(db,'money-stale',{},perform)); assert.equal(effects,1);
  assert.equal((await db.doc('moneyOperations/money-stale').get()).data().status,'needs_review');
});

test('any reviewed eligible move receives one $5 refund without reducing the provider allocation', async () => {
  const stripe=fakeStripe(), service=benefits(stripe), ref=db.doc('jobs/money-refund');
  await ref.set({customerId:'money-customer',providerIds:['money-crew'],status:'completed',paymentStatus:'paid',releaseConfirmedAt:Timestamp.now(),reviewed:true,reviewRating:1,reviewRefundEligible:true,paymentIntentId:'pi_money_review',allocatedCents:9000,platformFeeCents:1350,providerPayoutCents:7650});
  await Promise.all([service.refundReviewedMove(ref.id),service.refundReviewedMove(ref.id)]);
  assert.equal(stripe.refundsMade.size,1); assert.equal(stripe.transfersMade.size,0);
  const request=[...stripe.refundsMade.values()][0].params;
  assert.equal(request.amount,500); assert.equal(request.payment_intent,'pi_money_review'); assert.equal(request.reverse_transfer,undefined);
  assert.equal((await ref.get()).data().providerPayoutCents,7650); assert.equal((await ref.get()).data().reviewRefundStatus,'refunded');
  await service.updateReviewRefund({id:'re_0',amount:500,currency:'usd',payment_intent:'pi_money_review',status:'pending',metadata:{kind:'review_refund',jobId:ref.id}});
  assert.equal((await ref.get()).data().reviewRefundStatus,'refunded');
});

test('tips require a real review, then transfer exactly 90% once through webhook replay', async () => {
  const stripe=fakeStripe(), service=benefits(stripe), ref=db.doc('jobs/money-tip');
  await db.doc('providers/money-tip-crew').set({stripeAccountId:'acct_demo_tip'});
  await ref.set({customerId:'money-customer',providerIds:['money-tip-crew'],status:'completed',reviewed:false});
  await assert.rejects(()=>service.createTipCheckout('another-customer',undefined,ref.id,2000,'https://wontstopmoving.com'));
  await assert.rejects(()=>service.createTipCheckout('money-customer',undefined,ref.id,2000,'https://wontstopmoving.com'));
  await ref.update({reviewed:true});
  await assert.rejects(()=>service.createTipCheckout('money-customer',undefined,ref.id,2000,'https://wontstopmoving.com'));
  await db.doc(`providers/money-tip-crew/reviews/${ref.id}`).set({rating:1});
  await service.createTipCheckout('money-customer',undefined,ref.id,2000,'https://wontstopmoving.com');
  const session={id:'cs_0',payment_status:'paid',currency:'usd',amount_total:2000,payment_intent:'pi_money_tip',metadata:{flow:'move_tip',jobId:ref.id,customerId:'money-customer'}};
  await assert.rejects(()=>service.confirmTipCheckout({...session,amount_total:1}));
  await Promise.all([service.confirmTipCheckout(session),service.confirmTipCheckout(session)]);
  assert.equal(stripe.transfersMade.size,1); assert.equal([...stripe.transfersMade.values()][0].params.amount,1800);
  assert.equal((await ref.get()).data().tipCents,2000);
  await assert.rejects(()=>service.createTipCheckout('money-customer',undefined,ref.id,2000,'https://wontstopmoving.com'));
});

test('a refunded tip payment is never transferred to the provider', async () => {
  const stripe=fakeStripe(), service=benefits(stripe), id='money-refunded-tip';
  await db.doc(`jobs/${id}`).set({customerId:'money-customer',status:'completed',reviewed:true});
  await db.doc(`moveTips/${id}`).set({customerId:'money-customer',checkoutSessionId:'cs_refunded_tip',amountCents:2000,providerCents:1800,accountId:'acct_demo_tip'});
  stripe.paymentIntents.retrieve=async()=>({status:'succeeded',currency:'usd',latest_charge:{id:'ch_refunded_tip',refunded:true,amount_refunded:2000}});
  await assert.rejects(()=>service.confirmTipCheckout({id:'cs_refunded_tip',payment_status:'paid',currency:'usd',amount_total:2000,payment_intent:'pi_refunded_tip',metadata:{flow:'move_tip',jobId:id,customerId:'money-customer'}}));
  assert.equal(stripe.transfersMade.size,0);
});

test('only the assigned crew can redeem its code; each allocation pays independently once', async () => {
  const stripe=fakeStripe();
  const lifecycle=load('jobs', { './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{}}, './shop':{}, './routing':{}, './referrals':{}, './rewards':{grantMoveCredit:async()=>{}}, '@/lib/stripe':{stripe}, './mover-orders':{}, './move-benefits':{}, './money-operation':{moneyOperation} });
  for(const [id,uid,cents] of [['money-release-a','money-release-crew-a',9000],['money-release-b','money-release-crew-b',13000]]) {
    await db.doc(`providers/${uid}`).set({stripeAccountId:`acct_${uid}`,stripeOnboardingComplete:true});
    await db.doc(`jobs/${id}`).set({customerId:'money-customer',providerIds:[uid],status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_shared_release',orderId:'money-shared-order',amountPaid:cents/100,providerPayoutCents:providerShareCents(cents),reviewRefundEligible:true});
    await db.doc(`jobSecrets/${id}`).set({customerId:'money-customer',releaseCode:id.endsWith('a')?'123456':'654321',failedAttempts:0});
  }
  await assert.rejects(()=>lifecycle.completeJobWithCode({jobId:'money-release-a',code:'123456',uid:'money-release-crew-b',isAdmin:false}));
  await assert.rejects(()=>lifecycle.completeJobWithCode({jobId:'money-release-a',code:'654321',uid:'money-release-crew-a',isAdmin:false}));
  await lifecycle.completeJobWithCode({jobId:'money-release-a',code:'123456',uid:'money-release-crew-a',isAdmin:false});
  assert.equal((await db.doc('jobs/money-release-b').get()).data().status,'confirmed');
  await assert.rejects(()=>lifecycle.completeJobWithCode({jobId:'money-release-a',code:'123456',uid:'money-release-crew-a',isAdmin:false}));
  await lifecycle.payoutCompletedJob('money-release-a');
  await lifecycle.completeJobWithCode({jobId:'money-release-b',code:'654321',uid:'money-release-crew-b',isAdmin:false});
  assert.equal(stripe.transfersMade.size,2);
  assert.ok([...stripe.transfersMade.values()].every(item => !('transfer_group' in item.params)));
  assert.equal([...stripe.transfersMade.values()].reduce((sum,item)=>sum+item.params.amount,0),18700);
});

test('dispatcher requires verified sender, current consent and no STOP; stale queues and legacy booleans cannot send', async () => {
 const saved={...process.env},originalFetch=globalThis.fetch;let sends=0;
 try {
  process.env.NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED='true';process.env.TWILIO_TOLL_FREE_VERIFIED='false';process.env.TWILIO_ACCOUNT_SID='AC'+'1'.repeat(32);process.env.TWILIO_AUTH_TOKEN='test-token';process.env.TWILIO_FROM_NUMBER='+18887416683';
  globalThis.fetch=async (_url,options)=>{sends++;assert.equal(options.body.get('From'),'+18887416683');assert.ok(options.body.get('StatusCallback').startsWith('https://wontstopmoving.com/api/webhooks/twilio/status?id='));return new Response(JSON.stringify({sid:'SM'+'6'.repeat(32)}),{status:201,headers:{'Content-Type':'application/json'}});};
  const sms=load('move-sms',{'./firebase-admin':{adminDb:()=>db}}),consent=load('sms-consent',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock});
  const uid='money-dispatch-customer',phone='+15555550277',jobId='money-dispatch-job';
  await db.doc(`jobs/${jobId}`).set({customerId:uid,paymentStatus:'paid',status:'confirmed',smsConsent:true,notificationPhone:phone});
  assert.equal(await sms.queueReleaseText(jobId,phone,'WontStopMoving: test code'), 'pending_configuration');assert.equal(sends,0);
  process.env.TWILIO_TOLL_FREE_VERIFIED='true';
  const releaseId=(await import('node:crypto')).createHash('sha256').update(`release:${jobId}`).digest('hex');
  assert.equal(await sms.deliverMoveText(releaseId),'cancelled');assert.equal(sends,0);
  await consent.saveSmsConsent({subject:`user:${uid}`,customerId:uid,phone,consent:true,version:consentShared.SMS_DISCLOSURE_VERSION,source:'test'});
  assert.equal(await sms.queueMoveText(`notice:${jobId}`,jobId,phone,'WontStopMoving: test job update'),'accepted');assert.equal(sends,1);
  assert.equal(await sms.queueMoveText(`notice:${jobId}`,jobId,phone,'WontStopMoving: duplicate'),'accepted');assert.equal(sends,1);
  await db.doc(`smsSuppressions/${consent.smsPhoneId(phone)}`).set({optedOut:true,phone});
  assert.equal(await sms.queueMoveText(`blocked:${jobId}`,jobId,phone,'WontStopMoving: suppressed'),'cancelled');assert.equal(sends,1);
  await db.doc(`smsSuppressions/${consent.smsPhoneId(phone)}`).delete();
  const staleId='f'.repeat(64);await db.doc(`smsOutbox/${staleId}`).set({jobId,key:`stale:${jobId}`,to:phone,body:'Old message',status:'pending',createdAt:Timestamp.fromMillis(Date.now()-2*86400000)});
  assert.equal(await sms.deliverMoveText(staleId),'cancelled');assert.equal(sends,1);
 } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
