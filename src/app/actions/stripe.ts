'use server';

import { stripe } from '@/lib/stripe';
import { calculateMoveTotal } from '@/lib/pricing';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createCheckoutSession(formData: FormData) {
  const quoteId = formData.get('quoteId') as string;
  const moveSize = formData.get('moveSize') as string;
  const addOnsJson = formData.get('addOns') as string;
  const customerEmail = formData.get('email') as string;
  
  const addOns = JSON.parse(addOnsJson || '[]');
  const totalAmount = calculateMoveTotal(moveSize, addOns);

  const origin = (await headers()).get('origin');

  const session = await stripe.checkout.sessions.create({
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${moveSize.toUpperCase()} Professional Move`,
            description: `Scheduled move via Wont Stop Moving. Includes ${addOns.length} add-ons.`,
          },
          unit_amount: Math.round(totalAmount * 100), // Stripe expects cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/dashboard/customer/moves?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/customer/quotes?cancelled=true`,
    metadata: {
      quoteId,
      moveSize,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create Stripe Checkout session');
  }

  redirect(session.url);
}
