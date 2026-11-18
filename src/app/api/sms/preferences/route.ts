import { queueConsentConfirmation } from '@/lib/server/move-sms';
import { NextResponse } from 'next/server';
import { requireRole, readJson, errorResponse, HttpError } from '@/lib/server/auth';
import { getSmsPreferences, saveSmsConsent } from '@/lib/server/sms-consent';
import { allow } from '@/lib/server/rate-limit';

export async function GET(req: Request) {
  try { const {user} = await requireRole(req, ['customer','provider','admin']); return NextResponse.json(await getSmsPreferences(user.uid), {headers:{'Cache-Control':'private, no-store'}}); } catch(error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const {user,role} = await requireRole(req, ['customer','provider','admin']);
    if (!allow(`sms-prefs:${user.uid}`,20,3600000)) throw new HttpError(429, 'Please wait before changing text preferences again.');
    const body = await readJson(req);
    if (typeof body.smsConsent !== 'boolean') throw new HttpError(400, 'Choose your text preference.');
    await saveSmsConsent({subject:`user:${user.uid}`,customerId:user.uid,phone:body.phone,consent:body.smsConsent,version:body.smsDisclosureVersion,source:'account_preferences',sourcePage:body.smsSourcePage,provider:role==='provider'});
    if(body.smsConsent===true)await queueConsentConfirmation(`user:${user.uid}`).catch(()=>{});
    return NextResponse.json(await getSmsPreferences(user.uid));
  } catch(error) { return errorResponse(error); }
}
