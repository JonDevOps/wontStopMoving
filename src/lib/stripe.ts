import Stripe from 'stripe';

/**
 * Initialize Stripe with the secret key from environment variables.
 * We use a placeholder if the key is missing to prevent module evaluation crashes 
 * during build or initial load. The real key is required for actual API calls.
 */
const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_required';

if (apiKey === 'sk_test_placeholder_key_required' && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: STRIPE_SECRET_KEY is missing in production environment.');
}

export const stripe = new Stripe(apiKey, {
  apiVersion: '2025-01-27', // Use latest API version
  typescript: true,
});
