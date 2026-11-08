import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/server/firebase-admin';
import { syncConnectedAccountStatus } from '@/lib/server/connect-status';

/** Connected-account snapshots have a separate Stripe destination and secret. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '';
  const signature = req.headers.get('stripe-signature');
  if (!secret.startsWith('whsec_') || !signature) return new NextResponse('Webhook not configured', { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return new NextResponse('Invalid signature', { status: 400 }); }
  if (event.livemode !== (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_') || event.type !== 'account.updated') {
    return NextResponse.json({ received: true });
  }
  const account = event.data.object as Stripe.Account;
  if (!event.account || event.account !== account.id) return new NextResponse('Invalid account scope', { status: 400 });
  try {
    await syncConnectedAccountStatus(adminDb(), account.id, id => stripe.accounts.retrieve(id));
  } catch {
    // API outages and database failures must be retried by Stripe.
    console.error(`Connected-account webhook ${event.id} failed`);
    return new NextResponse('Retry later', { status: 500 });
  }
  return NextResponse.json({ received: true });
}
