import { NextResponse } from 'next/server';
import { createMoverCheckout } from '@/lib/server/mover-checkout';
import { guestCustomer } from '@/lib/server/guest-account';
import { errorResponse, HttpError, readJson, siteOrigin } from '@/lib/server/auth';
import { allow, clientIp } from '@/lib/server/rate-limit';

/** Pay for a mover cart without signing in (#151). The account is created from these details. */
export async function POST(req: Request) {
  try {
    if (!allow(`guest-checkout:${clientIp(req)}`, 10, 3600_000)) throw new HttpError(429, 'Too many checkout attempts. Try again later or call us.');
    const body = await readJson(req);
    const { uid, email } = await guestCustomer({ name: body.name, email: body.email, phone: body.contactPhone });
    return NextResponse.json(await createMoverCheckout(uid, email, body, siteOrigin(req), { guest: true }));
  } catch (error) { return errorResponse(error); }
}
