import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { stripe } from '@/lib/stripe';
import { HttpError, requireStripe } from './auth';
import { moneyOperation } from './money-operation';
import { applyCredit, verifyJobCredit } from './rewards';

/** Full, admin-approved cancellation before code release. Never reverses a provider payout. */
export async function cancelAndRefundBooking(jobId: string, adminId: string) {
  const db=adminDb(), ref=db.doc(`jobs/${jobId}`);
  const prior=(await ref.get()).data();
  if (!prior) throw new HttpError(404,'Move not found.');
  if (prior.bookingRefundStatus === 'refunded') return {status:'refunded'};
  await verifyJobCredit(prior);
  const job=await db.runTransaction(async tx=>{
    const j=(await tx.get(ref)).data();
    if (!j) throw new HttpError(404,'Move not found.');
    if (j.bookingRefundStatus === 'refunded') return j;
    if (j.releaseConfirmedAt || j.payoutTransferId || j.status === 'completed') throw new HttpError(409,'Funds have been released. Contact support for payout and refund reconciliation.');
    if (j.paymentStatus !== 'paid' || (j.paymentHold && j.paymentHoldReason !== 'cancellation_refund')) throw new HttpError(409,'This payment needs manual review before refunding.');
    const cardCents=Math.round(Number(j.amountPaid || 0)*100), credit=Number(j.creditApplied || 0), gift=Number(j.giftApplied || 0);
    if (![cardCents,credit,gift].every(Number.isFinite) || cardCents<0 || credit<0 || gift<0 || gift>credit || !(cardCents+credit*100>0)) throw new HttpError(409,'Payment funding needs review.');
    tx.update(ref,{status:'cancelled',paymentHold:true,paymentHoldReason:'cancellation_refund',bookingRefundStatus:'processing',bookingRefundCardCents:cardCents,bookingRefundCredit:credit,bookingRefundGift:gift,cancelledBy:adminId,cancelledAt:FieldValue.serverTimestamp()});
    return {...j,bookingRefundCardCents:cardCents,bookingRefundCredit:credit,bookingRefundGift:gift};
  });
  if (job.bookingRefundStatus === 'refunded') return {status:'refunded'};
  try {
    if (!job.bookingRefundCardCents) {await finishBookingRefund(jobId,null);return {status:'refunded'};}
    requireStripe();
    if (job.bookingRefundId) {
      await updateBookingRefund(await stripe.refunds.retrieve(job.bookingRefundId));
      return {status:(await ref.get()).data()?.bookingRefundStatus};
    }
    const result=await moneyOperation(db,`cancel-refund-${jobId}`,{payment_intent:job.paymentIntentId,amount:job.bookingRefundCardCents,metadata:{kind:'booking_cancellation',jobId}},async(request,key)=>{
      const pi=await stripe.paymentIntents.retrieve(String(request.payment_intent),{expand:['latest_charge']});
      const charge=typeof pi.latest_charge==='object' ? pi.latest_charge : null;
      if (pi.status!=='succeeded'||pi.currency!=='usd'||!charge||charge.disputed||charge.amount-charge.amount_refunded<Number(request.amount)) throw new Error('CANCELLATION_REQUIRES_REVIEW');
      if (charge.amount_refunded > 0) {
        const siblings=await db.collection('jobs').where('paymentIntentId','==',request.payment_intent).get();
        const known=siblings.docs.reduce((sum,d)=>sum+(d.data().reviewRefundStatus==='refunded'&&d.data().reviewRefundId?Number(d.data().reviewRefundCents||0):0)+(d.data().bookingRefundStatus==='refunded'&&d.data().bookingRefundId?Number(d.data().bookingRefundCardCents||0):0),0);
        if (known!==charge.amount_refunded) throw new Error('EXISTING_REFUND_REQUIRES_REVIEW');
      }
      return stripe.refunds.create(request as unknown as Stripe.RefundCreateParams,{idempotencyKey:key});
    });
    await ref.update({bookingRefundId:result.id});
    if (result.status==='succeeded') await finishBookingRefund(jobId,result.id);
    else await ref.update({bookingRefundStatus:['failed','canceled'].includes(result.status||'')?'needs_review':'processing'});
    return {status:(await ref.get()).data()?.bookingRefundStatus};
  } catch {await ref.update({bookingRefundStatus:'needs_review'});return {status:'needs_review'};}
}

async function finishBookingRefund(jobId: string, refundId: string|null) {
  const db=adminDb(), ref=db.doc(`jobs/${jobId}`);
  await db.runTransaction(async tx=>{
    const job=(await tx.get(ref)).data();
    if (!job||job.bookingRefundStatus==='refunded') return;
    if (job.status!=='cancelled'||job.releaseConfirmedAt||job.payoutTransferId||job.paymentHoldReason!=='cancellation_refund') throw new Error('CANCELLATION_REQUIRES_REVIEW');
    if (job.bookingRefundCredit) await applyCredit(tx,job.customerId,job.bookingRefundCredit,'booking-refund',`booking-refund-${jobId}`,{jobId,giftReturned:job.bookingRefundGift||0});
    tx.update(ref,{paymentStatus:'refunded',bookingRefundStatus:'refunded',bookingRefundId:refundId,bookingRefundedAt:FieldValue.serverTimestamp(),paymentHold:true});
  });
}

export async function updateBookingRefund(refund: Stripe.Refund) {
  if (refund.metadata?.kind!=='booking_cancellation'||!refund.metadata.jobId) return;
  const ref=adminDb().doc(`jobs/${refund.metadata.jobId}`),job=(await ref.get()).data();
  const intent=typeof refund.payment_intent==='string'?refund.payment_intent:refund.payment_intent?.id;
  if (!job||job.paymentHoldReason!=='cancellation_refund'||intent!==job.paymentIntentId||refund.currency!=='usd'||refund.amount!==job.bookingRefundCardCents||(job.bookingRefundId&&job.bookingRefundId!==refund.id)) return;
  if (job.bookingRefundStatus === 'refunded' && !['failed','canceled'].includes(refund.status || '')) return;
  await verifyJobCredit(job);
  if (refund.status==='succeeded') await finishBookingRefund(ref.id,refund.id);
  else await ref.update({bookingRefundId:refund.id,bookingRefundStatus:['failed','canceled'].includes(refund.status||'')?'needs_review':'processing'});
}
