'use server';

import { stripe } from '@/lib/stripe';
import { calculateMoveTotal } from '@/lib/pricing';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Creates a Stripe Checkout Session for a specific quote.
 * This is called from the "Pay & Book" button on the customer dashboard.
 */
export async function createCheckoutSession(formData: FormData) {
  const quoteId = formData.get('quoteId') as string;
  const customerId = formData.get('customerId') as string;
  const moveSize = formData.get('moveSize') as string;
  const addOnsJson = formData.get('addOns') as string;
  const customerEmail = formData.get('email') as string;
  const isStudent = formData.get('isStudent') === 'true';
  const isMilitary = formData.get('isMilitary') === 'true';
  const isExpress = formData.get('isExpress') === 'true';
  
  const addOns = JSON.parse(addOnsJson || '[]');
  const totalAmount = calculateMoveTotal(moveSize, addOns, { isStudent, isMilitary, isExpress });

  const origin = (await headers()).get('origin');

  const session = await stripe.checkout.sessions.create({
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${moveSize.toUpperCase()} Professional Move`,
            description: `Wont Stop Moving: Nationwide logistics for your ${moveSize} relocation. Includes ${addOns.length} premium add-ons.`,
          },
          unit_amount: Math.round(totalAmount * 100), // Stripe expects cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    // Metadata is critical for the webhook to know which quote/user to update after payment
    metadata: {
      quoteId,
      customerId,
      moveSize,
    },
    success_url: `${origin}/dashboard/customer/moves?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/customer/quotes?cancelled=true`,
  });

  if (!session.url) {
    throw new Error('Failed to create Stripe Checkout session');
  }

  redirect(session.url);
}
