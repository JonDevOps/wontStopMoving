# Marketplace rollout

## Approved behavior

Keep all existing `/locations/{state}/{city}` pages, direct booking/quote flows
and their sitemap entries. The added `/movers/` directory is the primary homepage
journey, using the existing state/province/city dataset.

Search → city results → provider → customize reservation → moving cart → Stripe
Checkout → one job and private payment code per crew reservation → crew redeems
its code after satisfactory completion → review → $5 original-method refund →
optional tip. Loading and unloading can use different providers, dates, hours
and start windows. A customer may also reserve the same provider twice, with
separate codes for each reservation.

## Implemented on this branch

- Homepage search, city results, provider pages, reservation customization and
  a tab-local cart. Street addresses are excluded from public URLs.
- At least $45/hour and two hours; providers may choose higher minimums. The
  lowest labor reservation is $90. The server verifies rates, supported service,
  date availability and current Stripe recipient capability before Checkout.
  A changed rate requires the customer to return and review the new quote.
- One immutable allocation per cart item. Paid webhook fulfillment validates the
  session, customer, amount and currency and creates all jobs/codes atomically.
  Duplicate and asynchronous payment events cannot duplicate jobs or codes.
- Codes are private in `jobSecrets`, visible only to the customer/admin, emailed
  only to the customer, and queued for text only with explicit number/consent.
  Dashboard codes remain available when delivery is delayed.
- An assigned provider's correct code completes only that job. The mover gets
  85%, W3Develops retains 15%. A durable money-request ledger freezes the amount
  and destination and uses one Stripe idempotency key per payout/refund/tip.
- New marketplace jobs offer a $5 refund for any honest review after code
  redemption. It returns to the original payment method and uses the platform's
  share; the provider allocation is unchanged. Reviews disclose the incentive.
  Review writes/eligibility are server-only; negative reviews receive the same
  refund and are displayed publicly. No incentive is tied to a Google review.
- Tip checkout is unavailable until a real review exists. Optional tips pay 90%
  to the mover, retaining a disclosed 10% processing/platform fee, with no extra
  15% booking fee. Webhook replays cannot duplicate the tip transfer.
- Admin follow-up at `/dashboard/admin/mover-payments`, plus recovery in the
  existing authenticated hourly scheduler. Ambiguous requests older than
  23 hours stop for Stripe reconciliation instead of replaying after the
  idempotency retention window. Full refunds/disputes hold unreleased jobs.
- Stripe SDK updated to 23.1.0 (matching API selected by the pinned SDK).
  Dynamic payment methods and signed asynchronous fulfillment are used.

## Configuration and release checks still required

### Text-message workflow

- Successful paid booking: customer gets their private payment code and job link;
  opted-in assigned providers get a new-job text with their dashboard link.
- The customer shares the code after completion; the assigned provider redeems
  it. The customer then gets a review link. The provider gets a code-accepted
  alert that distinguishes a transfer sent to Stripe from a payout awaiting help.
- Customer consent is collected at cart checkout. Provider consent and mobile
  number are managed privately under Services & Pricing → Job text notifications.
- Messages are keyed by event/job/provider to prevent duplicate sends. Pending
  texts recheck current consent and job state before sending. Ambiguous sends
  remain for review instead of automatic resending.
- The owner confirmed trial SMS and calls were received on November 16, 2026.
  Those Console tests do not prove this app's custom messages are delivered.
  Twilio's current trial restricts custom bodies and recipients; production
  payment-code/review-link traffic still needs an upgraded registered sender.
- The owner confirmed A Moving Service also handles Wont Stop Moving in Stripe.
  A managed `Wont Stop Moving marketplace QA` sandbox was created under that
  account; authorization and a complete test payment round trip remain pending.

- Set up Twilio sending service/number and its applicable sender registration.
  Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in managed
  secrets, never source or chat. Until configured, texts are honestly marked
  `pending_configuration`; an API acceptance is not a delivery confirmation.
  Twilio's STOP handling must remain enabled. Ambiguous sends require review.
- Verify the platform Stripe webhook subscribes to Checkout completed,
  asynchronous success/failure, expired; refund created/updated/failed;
  charge refunded and dispute created events. Keep the Connect destination
  separate. Check current recipient capability access for existing accounts.
- Run a dedicated Stripe sandbox round trip before production activation:
  pay a two-crew order, redeem each code independently, submit a low-star review,
  confirm a real $5 test refund, and complete a tip. Local accounting tests use
  simulated Stripe responses; they do not establish live account configuration.
- Validate configured email/SMS delivery with owner-approved test recipients.
  Local tests disable both delivery services and cannot prove real delivery.
- City routes cover the existing dataset. Nearby discovery currently uses US/PR
  ZIP centers with a 50-mile radius. Where no center exists, including Canadian
  cities, only explicit provider `serviceAreaCities` entries match. Full Canadian
  proximity geocoding and indexed nationwide discovery remain outstanding.
- Existing legacy direct quote rewards remain separate. New marketplace jobs
  receive the original-method review refund instead of completion move credit.

## Validation policy

Use isolated demo-wsm emulators and synthetic providers, with no live payments,
customer emails or SMS. Check types, lint, production build, rules/API/accounting
and browser flows. Existing city files must remain intact. Keep this work in draft
until payment configuration and the test round trip are verified for release.
