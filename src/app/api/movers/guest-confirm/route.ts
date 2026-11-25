import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { confirmPaidCheckout } from '@/lib/server/jobs';
import { errorResponse, HttpError, readJson, requireStripe } from '@/lib/server/auth';

/**
 * Guest return page (#151): confirms a guest cart's paid Stripe session, the
 * same way the webhook does (idempotent). Returns only whether it's paid.
 */
export async function POST(req: Request) {
  try {
    requireStripe();
    const { sessionId } = await readJson(req);
    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) throw new HttpError(400, 'Invalid checkout session.');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.flow !== 'mover_cart' || session.metadata?.guest !== 'true') throw new HttpError(404, 'Checkout not found.');
    if (session.payment_status === 'paid') await confirmPaidCheckout(session);
    return NextResponse.json({ paid: session.payment_status === 'paid' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
