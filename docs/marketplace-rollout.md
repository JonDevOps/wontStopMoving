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
  account; authorization and the test payment/refund/transfer/tip round trip are now complete (November 17).

- Set up Twilio sending service/number and its applicable sender registration.
  Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in managed
  secrets, never source or chat. Until configured, texts are honestly marked
  `pending_configuration`; an API acceptance is not a delivery confirmation.
  Twilio's STOP handling must remain enabled. Ambiguous sends require review.
- The platform Stripe webhook now subscribes to Checkout completed,
  asynchronous success/failure, expired; refund created/updated/failed;
  charge refunded and dispute created events. Keep the Connect destination
  separate. Check current recipient capability access for existing accounts.
- Completed the dedicated Stripe sandbox round trip before production activation:
  paid a two-crew order, redeemed each code independently, used a low-star review fixture,
  confirmed a real $5 test refund, and completed a tip. Local accounting tests use
  simulated Stripe responses; they do not establish live account configuration.
- Email fallback was confirmed in the owner's inbox after an explicitly approved test.
  SMS delivery remains deferred until the owner activates Twilio.
  Local tests disable both delivery services and cannot prove real delivery.
- City routes cover the existing dataset. Indexed nearby discovery uses US/PR
  ZIP centers plus 792 matched Canadian places with a 50-mile radius. Where no
  reliable center exists, explicit provider `serviceAreaCities` entries match.
- Existing legacy direct quote rewards remain separate. New marketplace jobs
  receive the original-method review refund instead of completion move credit.

## Validation policy

Use isolated demo-wsm emulators and synthetic providers, with no live payments,
customer emails or SMS. Check types, lint, production build, rules/API/accounting
and browser flows. Existing city files must remain intact. Use the checkout activation gate until payment configuration, the sandbox round
trip and email fallback are verified. Keep SMS disabled until Twilio is ready.

## November 16 staged release

The owner authorized publishing completed work and deferring Twilio for two days.
`NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED=false` hides the customer SMS opt-in and
provider SMS settings, explains email/dashboard delivery, and prevents sends even
if Twilio credentials exist. Flip it only after sender approval and delivery QA.

`NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED=false` allows publishing the mover
directory and reservation/cart pages while rejecting marketplace payments on
the server and showing direct-booking/contact alternatives. Existing direct
bookings are unaffected by this flag. Enable it at BUILD and RUNTIME only after
the isolated Stripe round trip passes. The owner authorization to deploy does
not itself establish that external payment configuration has been verified.

The live Stripe account was verified as A Moving Service, Inc. on November 16.
At the staged release check, the platform webhook had only three Checkout
completion/failure events; its refund/dispute/expiry subscriptions were added
with explicit owner approval on November 17.

## November 17 release verification

- Staged release deployed as production App Hosting rollout `rollout-2026-11-17-001`, source commit `7334d579fbd27e02a21c8694f0f83a0d8281bcfe`. Home, mover directory, Arizona directory, Queen Creek results, the existing Los Angeles direct-booking page, and the combined sitemap returned HTTP 200. Both repositories merged passing release PRs.
- Owner specifically approved and deployed provider-pricing/private-review rules, then specifically approved the live platform webhook event additions. Checkout expiry, refund created/updated/failed, charge refunded and dispute created are now enabled alongside the original Checkout events. URL, signing secret and endpoint version were preserved.
- QA sandbox authorized and Connect enabled. A synthetic recipient has active transfers/payout capabilities. No production provider or customer payment records were changed by the money tests.
- Actual hosted Stripe sandbox Checkout collected $220 for separate $90 loading and $130 unloading reservations. Real server fulfillment/code/payout handlers ran against demo Firestore with Stripe calls transported through the authorized CLI. Wrong-provider redemption was rejected; separate codes released independently. Real test transfers were $76.50 and $110.50. Duplicate fulfillment and payout calls did not duplicate allocations/transfers.
- This caught a real Stripe error: setting a job transfer group conflicts with the order group already attached to the source charge. New payout requests now omit that override and inherit the charge's group. Do not rewrite ambiguous historical production money operations automatically; reconcile them first.
- An eligible one-star review fixture produced a successful real $5 test refund without reducing the mover allocation; a repeat call kept the same refund. Tipping was refused before review. Post-review hosted tip Checkout collected $20 and the real tip handler transferred $18, retaining $2. Duplicate confirmations kept one transfer.
- The sandbox check uses synthetic identities/addresses and demo Firestore. No real money, SMS or customer emails were used. Auth, authorization, signed-webhook behavior and review transactions are separately covered by emulator integration tests; the sandbox test does not claim that a real production payment webhook was delivered.
- SMTP authentication succeeded. After explicit owner approval, one clearly labeled test email without a real payment code was accepted by Zoho for `jonathan@w3develops.org`; the owner confirmed receipt in their inbox.
- Indexed search queries approved providers by nearby geohash ranges plus explicit service-city coverage, removes distance false positives, and counts completed jobs only for matching providers. Existing production providers' hashes were checked: 2 profiles, no hash repairs required, no provider writes. No production providers were approved/payment-ready at that check; approval and onboarding remain required before a provider can take bookings.
- Canadian coordinates cover 792 existing city routes using attributed GeoNames data. Unmatched/ambiguous place labels retain explicit city coverage, editable under provider Services & Pricing → Cities you serve. Existing `/locations` pages remain unchanged.
- Twilio remains deferred by the owner. Its build/runtime switch stays false until the owner purchases/registers a sender and delivery tests pass. No upgrade, purchase or charge was made for Twilio.

All required non-SMS payment/email checks above passed. The November 17 follow-up enables `NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED=true`; SMS remains false.
