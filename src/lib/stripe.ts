import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  // We provide a fallback for build time, but runtime will require the key
  console.warn('STRIPE_SECRET_KEY is not defined in environment variables.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27', // Use latest API version
  typescript: true,
});
