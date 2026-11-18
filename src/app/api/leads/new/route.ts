import { queueConsentConfirmation } from '@/lib/server/move-sms';
import { saveSmsConsent } from '@/lib/server/sms-consent';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireUser } from '@/lib/server/auth';
import { notifyNewLead } from '@/lib/server/leads';

/**
 * Called by the quote form right after a customer saves a quote, so the
 * customer gets an instant estimate email and the team gets a lead alert.
 * Only the quote's own customer may trigger it, and only for a fresh quote.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const { quoteId } = body;
    if (!isId(quoteId)) throw new HttpError(400, 'Choose a quote.');
    const q = (await adminDb().doc(`quotes/${quoteId}`).get()).data();
    if (!q) throw new HttpError(404, 'Quote not found.');
    if (q.customerId !== user.uid) throw new HttpError(403, 'This quote belongs to another account.');
    const created = q.createdAt?.toMillis?.() ?? Date.now();
    if (Date.now() - created > 60 * 60 * 1000) return NextResponse.json({ notified: false });
    if (typeof body.smsConsent === 'boolean') await saveSmsConsent({subject:`user:${user.uid}`,customerId:user.uid,phone:q.phone,consent:body.smsConsent,version:body.smsDisclosureVersion,source:'quote_form',sourcePage:body.smsSourcePage,eventId:`quote:${quoteId}`});
    if(body.smsConsent===true)await queueConsentConfirmation(`user:${user.uid}`).catch(()=>{});
    await notifyNewLead(quoteId);
    return NextResponse.json({ notified: true });
  } catch (error) { return errorResponse(error); }
}
