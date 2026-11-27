import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as rewardsShared from '../src/lib/rewards.ts';
import * as contact from '../src/lib/business-contact.ts';
import * as consentShared from '../src/lib/sms-consent.ts';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { moneyOperation } from '../src/lib/server/money-operation.ts';
import { providerShareCents, tipShareCents, moverCartSchema } from '../src/lib/mover-cart.ts';
import { validProviderPricing } from '../src/lib/mover-pricing.ts';

if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-wsm') throw new Error('Demo emulator required.');
process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED = 'true';
const app = initializeApp({ projectId: 'demo-wsm' }, 'marketplace-money-tests'), db = getFirestore(app);
before(async () => {
  for (const name of ['jobs','providers','jobSecrets','moverOrders','moveTips','moneyOperations','providerSmsPreferences','smsOutbox','rewardWallets','checkoutTerms']) {
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
  runInThisContext(`(function(require,module,exports){${output}\n})`)(id => id in mocks ? mocks[id] : id==='./rewards' ? rewardService() : ['../rewards','@/lib/rewards'].includes(id) ? rewardsShared : ['../business-contact','@/lib/business-contact'].includes(id) ? contact : id==='../sms-consent' ? consentShared : id==='./sms-consent' ? load('sms-consent',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock}) : id.startsWith('.') || id.startsWith('@/') ? (() => { throw new Error(`Unmocked dependency ${id}`); })() : require(id), loaded, loaded.exports);
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
    customers: { create: async () => ({ id: 'cus_demo_customer' }) },
    checkout: { sessions: { create: (params, options) => record(sessions, 'cs', params, options).then(result => ({...result,url:'https://checkout.stripe.com/c/pay/demo'})) } },
  };
}
function rewardService() { return load('rewards', {'@/lib/stripe':{stripe:fakeStripe()},'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{enqueueEmail:async()=>{}}}); }
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
  const checkout=load('mover-checkout', {'@/lib/stripe':{stripe},'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./terms':{requireCurrentTerms:()=>{},bookingTermsAcceptance:()=>({accepted:true})},'../mover-cart':{moverCartSchema,providerShareCents},'../mover-pricing':{validProviderPricing},'./mover-locations':{moverCity:()=>({city:'Queen Creek'})},'./mover-coverage':coverage,'./stripe-customer':load('stripe-customer',{'@/lib/stripe':{stripe},'./firebase-admin':{adminDb:()=>db}})});
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
  const lifecycle=load('jobs', { './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{}}, './shop':{}, './routing':{}, './referrals':{}, './rewards':{...rewardService(),grantMoveCredit:async()=>{}}, '@/lib/stripe':{stripe}, './mover-orders':{}, './move-benefits':{}, './money-operation':{moneyOperation}, './guest-account':{sendGuestPasswordEmail:async()=>{}}, './extra-hours':{payExtraCharges:async()=>true} });
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

test('customer can release their own paid move from the app, once, on or after the move date', async () => {
  const stripe=fakeStripe();
  const lifecycle=load('jobs', { './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{}}, './shop':{}, './routing':{}, './referrals':{}, './rewards':{...rewardService(),grantMoveCredit:async()=>{}}, '@/lib/stripe':{stripe}, './mover-orders':{}, './move-benefits':{}, './money-operation':{moneyOperation}, './guest-account':{sendGuestPasswordEmail:async()=>{}}, './extra-hours':{payExtraCharges:async()=>true} });
  const uid='money-custrelease-crew', today=new Date().toISOString().slice(0,10), later=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
  await db.doc(`providers/${uid}`).set({stripeAccountId:`acct_${uid}`,stripeOnboardingComplete:true});
  await db.doc('jobs/money-custrelease-now').set({customerId:'money-custrelease-customer',providerIds:[uid],status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_custrelease',amountPaid:100,providerPayoutCents:providerShareCents(10000),reviewRefundEligible:true,moveDate:today});
  await db.doc('jobs/money-custrelease-later').set({customerId:'money-custrelease-customer',providerIds:[uid],status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_custrelease_later',amountPaid:100,providerPayoutCents:providerShareCents(10000),reviewRefundEligible:true,moveDate:later});
  await assert.rejects(()=>lifecycle.releaseJobByCustomer({jobId:'money-custrelease-now',uid:'someone-else'}), /another account/);
  await assert.rejects(()=>lifecycle.releaseJobByCustomer({jobId:'money-custrelease-later',uid:'money-custrelease-customer'}), /on or after/);
  await lifecycle.releaseJobByCustomer({jobId:'money-custrelease-now',uid:'money-custrelease-customer'});
  const done=(await db.doc('jobs/money-custrelease-now').get()).data();
  assert.equal(done.status,'completed'); assert.equal(done.releasedByCustomer,true); assert.equal(done.payeeProviderId,uid);
  await assert.rejects(()=>lifecycle.releaseJobByCustomer({jobId:'money-custrelease-now',uid:'money-custrelease-customer'}), /already completed/);
  assert.equal(stripe.transfersMade.size,1);
  assert.equal([...stripe.transfersMade.values()][0].params.amount,providerShareCents(10000));
});

test('guest checkout creates or reuses a passwordless guest, and sends existing accounts to sign in', async () => {
  const auth=getAuth(app), sent=[];
  const guest=load('guest-account', { './firebase-admin':{adminDb:()=>db,adminAuth:()=>auth}, './auth':authMock, './notifications':{enqueueEmail:async (key,msg)=>{sent.push(msg);return {id:key,status:'sent'};}} });
  const stamp=Date.now(), email=`money-guest-${stamp}@example.com`, real=`money-real-${stamp}@example.com`;
  await assert.rejects(()=>guest.guestCustomer({name:'G',email,phone:'4155550100'}), /name/);
  await assert.rejects(()=>guest.guestCustomer({name:'Guest Person',email:'nope',phone:'4155550100'}), /email/);
  const first=await guest.guestCustomer({name:'Guest Person',email,phone:'4155550100'});
  const again=await guest.guestCustomer({name:'Guest Person',email,phone:'4155550100'});
  assert.equal(again.uid, first.uid);
  const profile=(await db.doc(`users/${first.uid}`).get()).data();
  assert.equal(profile.role,'customer'); assert.equal(profile.guestCheckout,true);
  const realUser=await auth.createUser({email:real,password:'password123'});
  await db.doc(`users/${realUser.uid}`).set({role:'customer',email:real});
  await assert.rejects(()=>guest.guestCustomer({name:'Real Person',email:real,phone:'4155550100'}), /Sign in/);
  await guest.sendGuestPasswordEmail(first.uid,'https://example.test');
  await guest.sendGuestPasswordEmail(first.uid,'https://example.test');
  assert.equal(sent.length,1); assert.equal(sent[0].to,email);
  await db.doc(`users/${first.uid}`).delete(); await db.doc(`users/${realUser.uid}`).delete();
});

test('extra hours: crew requests, customer accepts with the saved card, crew share pays out from that charge', async () => {
  const created=[], transfers=[]; let decline=false;
  const stripe={
    paymentIntents:{
      retrieve: async id => id==='pi_extra_orig' ? {id, customer:'cus_extra', payment_method:'pm_extra', setup_future_usage:'off_session'} : {id, latest_charge:'ch_extra_1', status:'succeeded'},
      create: async (params, options) => { if (decline) { const e=new Error('declined'); e.code='card_declined'; throw e; } created.push({params, options}); return {id:'pi_extra_new', status:'succeeded'}; },
    },
    transfers:{ create: async (params, options) => { transfers.push({params, options}); return {id:`tr_extra_${transfers.length}`}; } },
  };
  const extra=load('extra-hours', { '@/lib/stripe':{stripe}, './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>({})}, './money-operation':{moneyOperation}, '../mover-cart':{providerShareCents} });
  const base={customerId:'money-extra-customer',providerIds:['money-extra-crew'],status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_extra_orig',orderId:'money-extra-order',hoursReserved:2,hourlyRate:65,amountPaid:130,price:130};
  await db.doc('jobs/money-extra-a').set(base); await db.doc('jobs/money-extra-b').set(base);
  await assert.rejects(()=>extra.requestExtraHours({jobId:'money-extra-a',uid:'someone-else',isAdmin:false,hours:3,reason:'more boxes'}), /not assigned/);
  await assert.rejects(()=>extra.requestExtraHours({jobId:'money-extra-a',uid:'money-extra-crew',isAdmin:false,hours:2,reason:'x'}), /above 2/);
  const req=await extra.requestExtraHours({jobId:'money-extra-a',uid:'money-extra-crew',isAdmin:false,hours:4,reason:'More boxes than listed'});
  assert.equal(req.extraCents,13000);
  await assert.rejects(()=>extra.respondExtraHours({jobId:'money-extra-a',uid:'money-extra-crew',accept:true}), /another account/);
  const result=await extra.respondExtraHours({jobId:'money-extra-a',uid:'money-extra-customer',accept:true});
  assert.equal(result.chargedCents,13000);
  assert.equal(created.length,1); assert.equal(created[0].params.off_session,true); assert.equal(created[0].params.customer,'cus_extra'); assert.equal(created[0].params.amount,13000);
  const job=(await db.doc('jobs/money-extra-a').get()).data();
  assert.equal(job.hoursReserved,4); assert.equal(job.amountPaid,260); assert.equal(job.hoursRequest.status,'accepted');
  assert.equal(job.extraCharges[0].providerCents,providerShareCents(13000));
  await assert.rejects(()=>extra.respondExtraHours({jobId:'money-extra-a',uid:'money-extra-customer',accept:true}), /no hours change/);
  assert.equal(await extra.payExtraCharges('money-extra-a','acct_money_extra'),true);
  assert.equal(await extra.payExtraCharges('money-extra-a','acct_money_extra'),true);
  assert.equal(transfers.length,1); assert.equal(transfers[0].params.source_transaction,'ch_extra_1'); assert.equal(transfers[0].params.amount,providerShareCents(13000));
  await extra.requestExtraHours({jobId:'money-extra-b',uid:'money-extra-crew',isAdmin:false,hours:3,reason:'Long carry'});
  decline=true;
  await assert.rejects(()=>extra.respondExtraHours({jobId:'money-extra-b',uid:'money-extra-customer',accept:true}), /declined/);
  const failed=(await db.doc('jobs/money-extra-b').get()).data();
  assert.equal(failed.hoursRequest.status,'payment_failed'); assert.equal(failed.hoursReserved,2);
  await extra.respondExtraHours({jobId:'money-extra-b',uid:'money-extra-customer',accept:false});
  assert.equal((await db.doc('jobs/money-extra-b').get()).data().hoursRequest.status,'declined');
});

test('Book Now jobs: extra hours work without a cart order, and the base payout excludes extra-hours charges', async () => {
  const created=[];
  const stripeExtra={
    paymentIntents:{
      retrieve: async id => id==='pi_book_orig' ? {id, customer:'cus_book', payment_method:'pm_book', setup_future_usage:'off_session'} : {id, latest_charge:'ch_book_extra', status:'succeeded'},
      create: async (params, options) => { created.push({params, options}); return {id:'pi_book_extra', status:'succeeded'}; },
    },
    transfers:{ create: async () => ({id:'tr_book_extra'}) },
  };
  const extra=load('extra-hours', { '@/lib/stripe':{stripe:stripeExtra}, './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>({})}, './money-operation':{moneyOperation}, '../mover-cart':{providerShareCents} });
  const uid='money-book-crew', today=new Date().toISOString().slice(0,10);
  // Older Book Now jobs have no orderId and no hourlyRate: the rate is price / hours.
  await db.doc('jobs/money-book-a').set({customerId:'money-book-customer',providerIds:[uid],status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_book_orig',hoursReserved:2,amountPaid:130,price:130,moveDate:today});
  const req=await extra.requestExtraHours({jobId:'money-book-a',uid,isAdmin:false,hours:3,reason:'Long carry'});
  assert.equal(req.extraCents,6500);
  await extra.respondExtraHours({jobId:'money-book-a',uid:'money-book-customer',accept:true});
  assert.equal(created[0].params.customer,'cus_book');
  const stripe=fakeStripe();
  const lifecycle=load('jobs', { './firebase-admin':{adminDb:()=>db}, './auth':authMock, './notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{}}, './shop':{}, './routing':{}, './referrals':{}, './rewards':{...rewardService(),grantMoveCredit:async()=>{}}, '@/lib/stripe':{stripe}, './mover-orders':{}, './move-benefits':{}, './money-operation':{moneyOperation}, './guest-account':{sendGuestPasswordEmail:async()=>{}}, './extra-hours':{payExtraCharges:async()=>true} });
  await db.doc(`providers/${uid}`).set({stripeAccountId:`acct_${uid}`,stripeOnboardingComplete:true});
  await db.doc('jobs/money-book-a').update({paymentIntentId:'pi_book_release'});
  await lifecycle.releaseJobByCustomer({jobId:'money-book-a',uid:'money-book-customer'});
  // 85% of the original $130 only; the extra $65 is paid from its own charge.
  assert.equal([...stripe.transfersMade.values()][0].params.amount,providerShareCents(13000));
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

test('provider ranking: trusted ratings beat a single 5-star, top rated needs real history, featured is capped', async () => {
  const { providerScore, isTopRated, rankProviders, trustedRating } = await import('../src/lib/provider-rank.ts');
  const base = { rating: 0, reviewCount: 0, jobsCompleted: 0, cancellations: 0, verified: false, bioLength: 0, services: 1, monthsOnPlatform: 0, adminFeatured: false };
  const oneReview = { ...base, rating: 5, reviewCount: 1, jobsCompleted: 1 };
  const proven = { ...base, rating: 4.8, reviewCount: 30, jobsCompleted: 40, verified: true, bioLength: 120, services: 3, monthsOnPlatform: 14 };
  assert.ok(trustedRating(5, 1) < trustedRating(4.8, 30));
  assert.ok(providerScore(proven) > providerScore(oneReview));
  assert.equal(isTopRated(oneReview), false); assert.equal(isTopRated(proven), true);
  assert.ok(providerScore({ ...proven, cancellations: 20 }) < providerScore(proven));
  const list = [1,2,3,4,5].map(i => ({ id: `p${i}`, rank: { ...proven, reviewCount: 30 + i } })).concat([{ id: 'pinned', rank: { ...base, adminFeatured: true } }, { id: 'new', rank: oneReview }]);
  const ranked = rankProviders(list);
  assert.equal(ranked.filter(p => p.featured).length, 4);
  assert.ok(ranked.find(p => p.id === 'pinned').featured);
  assert.equal(ranked.find(p => p.id === 'new').featured, false);
  assert.ok(ranked.slice(0, 4).every(p => p.featured));
});

test('gift value covers the full price while promotional rewards retain their cap and refund split is exact', () => {
  assert.deepEqual(rewardsShared.creditBreakdown(100,250,250),{credit:100,gift:100,reward:0});
  assert.deepEqual(rewardsShared.creditBreakdown(100,250,40),{credit:55,gift:40,reward:15});
  assert.deepEqual(rewardsShared.creditBreakdown(100,99.99,99.99),{credit:99.5,gift:99.5,reward:0});
  assert.equal(rewardsShared.usableCredit(100,250),15);
  assert.deepEqual(rewardsShared.refundTenderSplit(500,8000,2000),{giftCents:400,cardCents:100});
  assert.deepEqual(rewardsShared.refundTenderSplit(500,10000,0),{giftCents:500,cardCents:0});
});

test('legacy gift balances are preserved and gift holds cannot overspend or restore twice', async () => {
  const service=rewardService(),uid='money-gift-wallet';
  await db.doc(`rewardWallets/${uid}`).set({balance:160});
  await db.doc(`rewardWallets/${uid}/ledger/gift-old`).set({amount:200,reason:'gift-card',createdAt:Timestamp.fromMillis(100)});
  await db.doc(`rewardWallets/${uid}/ledger/spend-old`).set({amount:-50,reason:'checkout',createdAt:Timestamp.fromMillis(200)});
  await db.doc(`rewardWallets/${uid}/ledger/reward-old`).set({amount:10,reason:'admin',createdAt:Timestamp.fromMillis(300)});
  const old=await service.getWallet(uid);assert.equal(old.balance,160);assert.equal(old.giftBalance,150);assert.equal(old.rewardBalance,10);
  await db.runTransaction(tx=>service.applyCredit(tx,uid,-100,'checkout','checkout-cs_money_gift_expiry',{sessionId:'cs_money_gift_expiry',giftApplied:100}));
  assert.equal((await service.getWallet(uid)).giftBalance,50);
  await assert.rejects(()=>db.runTransaction(tx=>service.applyCredit(tx,uid,-100,'checkout','overspend',{giftApplied:100})));
  const session={id:'cs_money_gift_expiry',payment_status:'unpaid',metadata:{customerId:uid,creditApplied:'99999'}};
  await service.releaseCheckoutCredit(session);await service.releaseCheckoutCredit(session);
  const returned=await service.getWallet(uid);assert.equal(returned.balance,160);assert.equal(returned.giftBalance,150);
  await assert.rejects(()=>db.runTransaction(tx=>service.checkoutCreditHeld(tx,uid,'checkout-cs_money_gift_expiry',100)));
});

test('fully gift-funded marketplace booking has a code, full provider allocation and no new card charge', async () => {
  const uid='money-gift-customer',id='money-gift-order',jobId='money-gift-job',service=rewardService();
  await db.doc(`rewardWallets/${uid}`).set({balance:250,giftBalance:250});
  await db.runTransaction(tx=>service.applyCredit(tx,uid,-100,'checkout',`checkout-order-${id}`,{giftApplied:100}));
  const item={jobId,providerId:'money-gift-crew',providerName:'Gift crew',totalCents:10000,creditCents:10000,giftCents:10000,cardCents:0,providerPayoutCents:8500,hourlyRate:50,payoutAccountId:'acct_gift_crew',moveDate:'2027-12-15',service:'loading',preferredStartTime:'morning',pickupAddress:'Demo pickup',dropoffAddress:'Demo dropoff',hours:2};
  await db.doc(`moverOrders/${id}`).set({customerId:uid,totalCents:10000,cardCents:0,creditApplied:100,giftApplied:100,items:[item],checkoutSessionId:'cs_money_gift',paymentStatus:'pending',termsAcceptance:{accepted:true}});
  const orders=load('mover-orders',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{notifyPaidJob:async()=>{}}});
  const session={id:'cs_money_gift',status:'complete',payment_status:'paid',currency:'usd',amount_total:0,payment_intent:null,metadata:{flow:'mover_cart',orderId:id,customerId:uid}};
  await orders.confirmMoverOrder(session);await orders.confirmMoverOrder(session);
  const job=(await db.doc(`jobs/${jobId}`).get()).data();
  assert.equal(job.amountPaid,0);assert.equal(job.creditApplied,100);assert.equal(job.giftApplied,100);assert.equal(job.providerPayoutCents,8500);assert.ok((await db.doc(`jobSecrets/${jobId}`).get()).data().releaseCode);
  const stripe=fakeStripe();
  const jobs=load('jobs',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{},notifyCompletedJobTexts:async()=>{}},'./shop':{},'./routing':{},'./referrals':{},'./rewards':service,'@/lib/stripe':{stripe},'./mover-orders':{},'./move-benefits':{},'./money-operation':{moneyOperation},'./guest-account':{sendGuestPasswordEmail:async()=>{}},'./extra-hours':{payExtraCharges:async()=>true}});
  await db.doc('providers/money-gift-crew').set({stripeAccountId:'acct_gift_crew',stripeOnboardingComplete:true});
  await db.doc(`jobs/${jobId}`).update({status:'completed',releaseConfirmedAt:Timestamp.now(),payeeProviderId:'money-gift-crew',reviewed:true});
  assert.equal((await jobs.payoutCompletedJob(jobId)).payoutStatus,'paid');await jobs.payoutCompletedJob(jobId);
  const transfer=[...stripe.transfersMade.values()][0];assert.equal(transfer.params.amount,8500);assert.equal(transfer.params.source_transaction,undefined);assert.equal(stripe.transfersMade.size,1);
  const benefitsService=benefits(stripe);await benefitsService.refundReviewedMove(jobId);await benefitsService.refundReviewedMove(jobId);
  assert.equal((await service.getWallet(uid)).giftBalance,155);assert.equal(stripe.refundsMade.size,0);assert.equal((await db.doc(`jobs/${jobId}`).get()).data().reviewRefundStatus,'refunded');
});

test('mixed gift/card review refunds preserve the original tender split and repeated callbacks cannot double-credit', async () => {
  const uid='money-mixed-customer',id='money-mixed-job',sessionId='cs_money_mixed',wallet=rewardService(),stripe=fakeStripe(),service=benefits(stripe);
  await db.doc(`rewardWallets/${uid}`).set({balance:80,giftBalance:80});
  await db.runTransaction(tx=>wallet.applyCredit(tx,uid,-80,'checkout',`checkout-${sessionId}`,{giftApplied:80}));
  await db.doc(`checkoutTerms/${sessionId}`).set({customerId:uid,totalCents:10000,creditApplied:80,giftApplied:80});
  await db.doc(`jobs/${id}`).set({id,customerId:uid,checkoutSessionId:sessionId,creditLedgerKey:`checkout-${sessionId}`,creditApplied:80,giftApplied:80,amountPaid:20,allocatedCents:10000,platformFeeCents:1500,status:'completed',paymentStatus:'paid',releaseConfirmedAt:Timestamp.now(),reviewed:true,reviewRefundEligible:true,paymentIntentId:'pi_money_mixed'});
  await service.refundReviewedMove(id);await service.refundReviewedMove(id);
  assert.equal(stripe.refundsMade.size,1);const refund=[...stripe.refundsMade.values()][0];assert.equal(refund.params.amount,100);
  assert.equal((await wallet.getWallet(uid)).giftBalance,4);
  await service.updateReviewRefund({id:refund.id,status:'succeeded',currency:'usd',payment_intent:'pi_money_mixed',amount:100,metadata:refund.params.metadata});
  assert.equal((await wallet.getWallet(uid)).giftBalance,4);
});

test('admin cancellation returns gift/reward/card amounts once and refuses jobs already released', async () => {
  const uid='money-cancel-customer',id='money-cancel-job',sid='cs_money_cancel',wallet=rewardService(),stripe=fakeStripe();
  const cancel=load('booking-refunds',{'./firebase-admin':{adminDb:()=>db},'@/lib/stripe':{stripe},'./auth':authMock,'./money-operation':{moneyOperation}});
  await db.doc(`rewardWallets/${uid}`).set({balance:90,giftBalance:80});
  await db.runTransaction(tx=>wallet.applyCredit(tx,uid,-90,'checkout',`checkout-${sid}`,{giftApplied:80}));
  await db.doc(`checkoutTerms/${sid}`).set({customerId:uid,totalCents:10000,creditApplied:90,giftApplied:80});
  await db.doc(`jobs/${id}`).set({id,customerId:uid,checkoutSessionId:sid,creditLedgerKey:`checkout-${sid}`,creditApplied:90,giftApplied:80,amountPaid:10,price:100,status:'confirmed',paymentStatus:'paid',paymentIntentId:'pi_money_cancel'});
  assert.equal((await cancel.cancelAndRefundBooking(id,'money-admin')).status,'refunded');await cancel.cancelAndRefundBooking(id,'money-admin');
  assert.equal(stripe.refundsMade.size,1);assert.equal([...stripe.refundsMade.values()][0].params.amount,1000);
  const result=await wallet.getWallet(uid);assert.equal(result.balance,90);assert.equal(result.giftBalance,80);assert.equal(result.rewardBalance,10);
  assert.equal((await db.doc(`jobs/${id}`).get()).data().paymentStatus,'refunded');
  await db.doc(`jobs/${id}-released`).set({status:'completed',releaseConfirmedAt:Timestamp.now(),paymentStatus:'paid',amountPaid:100});
  await assert.rejects(()=>cancel.cancelAndRefundBooking(`${id}-released`,'money-admin'));
});

test('zero-due fulfillment cannot invent funding and refunded gift purchases freeze spending', async () => {
  const uid='money-hold-customer',id='money-unfunded-order',wallet=rewardService();
  await db.doc(`rewardWallets/${uid}`).set({balance:100,giftBalance:100});
  const orders=load('mover-orders',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{notifyPaidJob:async()=>{}}});
  await db.doc(`moverOrders/${id}`).set({customerId:uid,checkoutSessionId:'cs_money_no_funding',paymentStatus:'pending',totalCents:10000,cardCents:0,creditApplied:100,giftApplied:100,items:[{jobId:'money-unfunded-job',totalCents:10000}]});
  await assert.rejects(()=>orders.confirmMoverOrder({id:'cs_money_no_funding',status:'complete',payment_status:'no_payment_required',amount_total:0,currency:'usd',metadata:{flow:'mover_cart',orderId:id,customerId:uid}}));
  assert.equal((await db.doc('jobs/money-unfunded-job').get()).exists,false);
  await db.doc('giftCardOrders/money-held-purchase').set({paymentIntentId:'pi_money_hold',code:'MONEYABC',status:'paid'});
  await db.doc('giftCards/MONEYABC').set({status:'redeemed',redeemedBy:uid,orderId:'money-held-purchase'});
  await wallet.holdGiftCardPurchase('pi_money_hold','charge.dispute.created');
  await assert.rejects(()=>db.runTransaction(tx=>wallet.applyCredit(tx,uid,-100,'checkout','blocked',{giftApplied:100})));
  assert.equal((await wallet.getWallet(uid)).balance,100);
});

test('cancelling the card-paid crew does not prevent payout to a separate gift-paid crew', async () => {
  const uid='money-split-customer',id='money-split-order',wallet=rewardService(),stripe=fakeStripe();
  await db.doc(`rewardWallets/${uid}`).set({balance:100,giftBalance:100});
  await db.runTransaction(tx=>wallet.applyCredit(tx,uid,-100,'checkout',`checkout-order-${id}`,{giftApplied:100}));
  const items=[0,1].map(i=>({jobId:`money-split-job-${i}`,providerId:`money-split-provider-${i}`,providerName:'Synthetic split crew',totalCents:10000,creditCents:i?0:10000,giftCents:i?0:10000,cardCents:i?10000:0,providerPayoutCents:8500,hourlyRate:50,payoutAccountId:'acct_split_crew',moveDate:'2027-12-15',service:'loading',preferredStartTime:'morning',pickupAddress:'Synthetic pickup',dropoffAddress:'Synthetic dropoff',hours:2}));
  await db.doc(`moverOrders/${id}`).set({customerId:uid,totalCents:20000,cardCents:10000,creditApplied:100,giftApplied:100,items,checkoutSessionId:'cs_money_split',paymentStatus:'pending',termsAcceptance:{accepted:true}});
  await load('mover-orders',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{notifyPaidJob:async()=>{}}}).confirmMoverOrder({id:'cs_money_split',payment_status:'paid',currency:'usd',amount_total:10000,payment_intent:'pi_money_split',metadata:{orderId:id,customerId:uid}});
  const cancellation=load('booking-refunds',{'./firebase-admin':{adminDb:()=>db},'@/lib/stripe':{stripe},'./auth':authMock,'./money-operation':{moneyOperation}});
  assert.equal((await cancellation.cancelAndRefundBooking(items[1].jobId,'money-admin')).status,'refunded');
  stripe.paymentIntents.retrieve=async()=>({status:'succeeded',currency:'usd',latest_charge:{id:'ch_money_split',refunded:true,disputed:false,amount:10000,amount_refunded:10000}});
  await db.doc('providers/'+items[0].providerId).set({stripeOnboardingComplete:true,stripeAccountId:'acct_split_crew'});
  await db.doc('jobs/'+items[0].jobId).update({status:'completed',releaseConfirmedAt:Timestamp.now(),payeeProviderId:items[0].providerId});
  const jobs=load('jobs',{'./firebase-admin':{adminDb:()=>db},'./auth':authMock,'./notifications':{enqueueEmail:async()=>{},notifyPaidJob:async()=>{},notifyCompletedJobTexts:async()=>{}},'./shop':{},'./routing':{},'./referrals':{},'./rewards':wallet,'@/lib/stripe':{stripe},'./mover-orders':{},'./move-benefits':{},'./money-operation':{moneyOperation},'./guest-account':{sendGuestPasswordEmail:async()=>{}},'./extra-hours':{payExtraCharges:async()=>true}});
  assert.equal((await jobs.payoutCompletedJob(items[0].jobId)).payoutStatus,'paid');
  assert.equal([...stripe.transfersMade.values()][0].params.amount,8500);
});
