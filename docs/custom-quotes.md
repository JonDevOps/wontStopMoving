# Custom quotes

Admins use **Customer Estimates → Create custom quote** to enter a recipient,
service scope/exclusions, route, move date, expiry, and pricing.

- Fixed quotes collect the full stated total at existing Stripe Checkout after
  explicit terms acceptance. The browser cannot supply the charged amount.
- Hourly estimates show a crew rate, minimum hours, estimated hours, and estimated
  total. They are review-only; issue a finalized fixed-price quote for payment.
  This avoids silently treating estimated hours as a final charge or deposit.
- Saving prepares a private review link and email. **Open email to customer**
  opens the owner's email app; the owner sends the email there. No automated
  SMTP delivery or delivery receipt is claimed. Copy-link sharing also works.
- New recipients create a customer account with the addressed email and verify
  it, then reopen the review link. Existing verified recipients can open directly.
  Opening binds the quote to that verified account; it does not record acceptance.
- Claimed quotes appear under My Quotes. Unclaimed quotes are admin-only in
  Firestore. The review API also requires the addressed verified email.
- Custom pricing/scope is immutable in browser clients, including admins. To
  revise a proposal, expire it in its admin detail page and create a replacement.
  Expiry/status is checked at checkout; fixed quotes already paid still fulfill
  if their signed payment webhook arrives after expiry.
- Quote acceptance uses the existing versioned terms and private per-checkout
  receipt. Paid jobs preserve the custom description and pricing alongside the
  actual paid amount. Existing calculated quotes remain supported.

Deploy Firestore rules before the application for this change: old clients do
not use the newly protected custom fields. The server APIs use Admin SDK writes.
The stricter rules prevent clients forging custom prices during rollout.
