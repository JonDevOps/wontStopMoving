# Customer terms acceptance

Current terms: version `2026-11-08`, published at `/terms` and permanently
available at `/terms/2026-11-08`. The hourly minimum is the minimum shown for the
selected provider and booking, as directed by the owner. Other existing clauses
are unchanged.

The unchecked agreement box is required for customer signup (including Google),
quote submission, direct provider bookings, and Pay & Book on an existing quote.
Existing Google sign-ins do not repeat signup. First-time customer Google sign-in
must complete the agreement before its customer profile is created.

`termsAcceptance` stores `accepted`, `version`, `documentPath`, `acceptedBy`,
`context`, and a Firebase-generated `acceptedAt` timestamp:

- Customer profiles record signup acceptance.
- Customer-submitted quotes record quote acceptance.
- Provider-booking jobs record booking acceptance before checkout opens.
- Quote checkout records booking acceptance on the quote and in the private
  `checkoutTerms/{checkoutSessionId}` collection. Fulfillment copies the exact
  paid session's acceptance to its job, including when another checkout attempt
  was opened later. Browser clients cannot access the private session records.

Firestore rules require the current version, exact document path, acting user,
expected context, and a real server timestamp for new customer profiles and
customer quote submissions. Browser updates cannot rewrite existing acceptance
or booking-acceptance fields. Admin-created leads need not claim customer
acceptance; they still require explicit agreement at customer checkout.

Both checkout APIs reject missing, false, malformed, or outdated acceptance
before creating a Stripe session. A current, explicit acceptance is required
again at booking even if the customer accepted terms when signing up or asking
for a quote. Historical profiles, quotes, and paid sessions are not backfilled
with invented agreement records.

## Publishing a revision

Keep each published document file immutable. Add the next document component and
its versioned route registry entry, switch `/terms` to it, update the shared
constants in `src/lib/terms.ts`, and update the current-version check in
`firestore.rules`. Run the emulator tests; they use the shared version constant
to catch mismatched rules and verify rejection of stale agreements.

Deploy the application before the new rules, then verify the live forms and API
rejections. Old open forms must refresh and review the current revision before
checkout. Do not remove old document routes when publishing a revision.
