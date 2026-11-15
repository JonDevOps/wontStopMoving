# Marketplace rollout

## Approved product direction

Keep every existing `/locations/{state}/{city}` page, direct booking and quote
flow. Make a separate `/movers/` marketplace the primary landing-page journey.

The full journey is search → city results → provider customization → cart →
Stripe payment → private per-job release codes → provider completion/payout →
review → $5 refund to original payment method → optional tip. The provider gets
85% of the job payment; W3Develops gets 15% and funds the review refund. Tips
unlock only after a review, with 90% to the provider and a disclosed 10% fee.
SMS delivery needs the SMS service and consent. No fake providers, reviews,
insurance coverage or competitor branding may be introduced.

## First preview

- Homepage search with service, region, city, addresses, date and start window.
- Region/city directory routes and city-specific filtered provider results.
- Provider detail route and handoff to the existing booking form.
- Existing city pages remain untouched; their sitemap entries remain present.
- Minimum $45 hourly rate and two-hour reservation at provider save, rules and
  server checkout. Legacy invalid pricing is unavailable until corrected by the
  provider; it is never silently increased before charging.
- Search passes date/time/service/hours and keeps street addresses in tab-local
  session storage rather than public URLs. No private files are used as photos.
- Results require approval, valid pricing and completed Stripe onboarding.
- Results honor explicitly blocked dates and configured working weekdays.
  Start-window preferences are not a guarantee of calendar availability.

The preview's Both option saves the unloading address and starts with the
loading city. Separate-provider cart selection is still part of the next phase;
the existing booking flow does not yet implement the planned multi-job cart.

Nearby discovery uses the existing US/PR ZIP city centers and a 50-mile search
radius. Other cities can match explicit `serviceAreaCities` entries in the form
`region-code/city-slug`; they must not show unverified nearby matches. Postal/city
geocoding for all Canadian regions remains part of completing coverage matching.

Customer review refunds, review-gated tipping, multi-provider cart payments,
code email/SMS delivery and their money/accounting tests still require completion
and review. Do not describe this first preview as the completed marketplace.

## Validation and release

Use isolated demo-wsm emulators for fixture providers and checkout guards; no
live charges or customer emails. Typecheck, lint, production build, rules/API
tests and browser checks must pass. Submit a draft PR for the preview. Keep
production unchanged until the owner reviews the first milestone.
