# Stripe webhook handling

Platform Checkout events use `/api/webhooks/stripe` and `STRIPE_WEBHOOK_SECRET`:

- `checkout.session.completed` and `checkout.session.async_payment_succeeded` confirm paid sessions transactionally, once per booking.
- `checkout.session.async_payment_failed` marks an unpaid booking as `payment_failed` or marks the quote's current payment attempt as failed. The quote stays payable. Already-paid records and newer checkout attempts are never downgraded.
- `payment_intent.succeeded` is unnecessary for this Checkout integration and is not subscribed to.

Connected-account snapshots use a separate destination with `connect: true`, `/api/webhooks/stripe/connect`, and `STRIPE_CONNECT_WEBHOOK_SECRET`. Both secrets live in Google Secret Manager. This separation is necessary because the platform destination's `events_from: ["@self"]` scope does not receive connected providers' v1 `account.updated` events.

The Connect handler accepts `account.updated` only when the signed event's account matches the object ID and its mode matches the configured Stripe key. It finds the provider by the server-managed `stripeAccountId`, retrieves the latest Stripe account state instead of trusting a potentially stale snapshot, and updates only `stripeOnboardingComplete`. It never approves a provider, changes payout routing or transfers funds. Unknown providers are ignored, while Stripe/API/database failures return 500 so Stripe retries.

The existing Accounts integration is retained; this change does not migrate providers or change platform fees. Account status still uses the current integration's charges/payouts readiness rule.

Customer quote creation and updates cannot write `checkoutSessionId`, `paymentStatus` or `paymentFailedAt`. These fields are written by server routes and shown in the customer's dashboard.

## Verification

Run `npm run typecheck`, `npm run build`, then:

```sh
firebase emulators:exec --only auth,firestore --project demo-wsm 'npm run test:support'
```

The tests include delayed failure, duplicate and out-of-order events, wrong-customer attempts, wrong live/test mode, endpoint-specific signatures, Connect mapping ambiguity, current-state synchronization, and quote-field access control. A signed diagnostic on production verifies signature handling without using a payment event or changing customer/provider records. A genuine Stripe-origin delivery remains a separate end-to-end check.
