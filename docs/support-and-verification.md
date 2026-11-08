# Support and email verification

The contact form submits to `POST /api/support`. The server validates and bounds input, rejects the honeypot, and transactionally limits each email address to five enquiries per hour. It writes `supportTickets` and `supportIntakeLimits` using the Admin SDK. The existing default-deny Firestore rules intentionally prohibit all direct client access to both collections.

Admins use **Support** in the dashboard sidebar (`/dashboard/admin/support`). The inbox calls authenticated server APIs that verify a Firebase ID token and the current Firestore admin role. It loads 50 tickets at a time, supports status changes, and opens the admin's email application for replies. Replying does not automatically change the ticket's status or send an email from the server.

Email/password signup sends a Firebase verification email for customer, quote, provider and employee signup. A delivery failure does not fail account creation. Dashboard notices let password users resend the email and refresh their verified status. Verification is advisory; booking and dashboard access are not blocked. Google sign-in continues to use the Google provider's verified email state.

## Tests

With Node 24+, Java 21+ and Firebase CLI available:

```sh
npm run typecheck
npm run build
firebase emulators:exec --only auth,firestore --project demo-wsm 'npm run test:support'
```

The integration runner refuses to run without emulators. It starts a local production server on port 9014 with the demo project, runs Firestore access tests, support API tests, a real emulator verification-link round trip, and signed webhook/idempotency tests. No real emails, customers or payments are created.

## Stripe deployment configuration

`apphosting.yaml` uses the `STRIPE_WEBHOOK_SECRET` secret in Google Secret Manager. A literal backend `overrideEnv` value takes precedence over that declaration. The invalid literal override was removed; keep the backend using the Secret Manager reference. The Stripe endpoint for this site also subscribes to `checkout.session.async_payment_succeeded` so delayed successful payments reach the existing fulfillment handler.
