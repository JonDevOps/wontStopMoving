# SMS release checks — November 18, 2026

Target: Firebase `studio-6652665935-1850d`, App Hosting `wontstopmoving-backend-id`.

Local verification: all **139 tests passed**, production build and type checking passed. Lint: zero errors; 307 pre-existing/style warnings in the current full run. Desktop consent selection/unselection worked. At 390px the page width equaled the viewport, the SMS box was unchecked and not required, and both policy links were accessible. A scroll margin was added for the fixed mobile header.

Twilio’s existing credentials were placed in managed runtime secrets and verified with a read-only API request. Both credentials have backend access; the purchased number matched and Voice/SMS/MMS capabilities were confirmed. No live message, call, registration submission, additional number purchase or new paid subscription was performed. Temporary credential files were removed.

Release publication is pending at this document revision; consult the associated pull request and final release report for the exact deployed commit and verified public URLs. Do not describe local checks as a successful production rollout.

Public verification targets:
- https://wontstopmoving.com/privacy
- https://wontstopmoving.com/terms
- https://wontstopmoving.com/contact#sms-consent
- https://wontstopmoving.com/sms

Preserved direct-city booking routes, marketplace rates/minimums, payment codes, refund/tip calculations, Zoho sender aliases and Cloudflare DNS.

## Remaining external steps

Owner review of registration identity, legal business/EIN/address, expected message volume and submission approval; Twilio toll-free approval; incoming messaging webhook/Advanced Opt-Out configuration and real delivery/STOP checks after approval; owner-selected voice forwarding destination and voicemail decision; manual Zoho brand signature update. Hermes is documented, not connected.

Owner review is also needed for service-specific cancellation/valuation agreements and recording retention. No generic insurance or cancellation-fee guarantee was added. The previous accepted terms remain available at `/terms/2026-11-08`.

## Phone migration locations

- `src/app/accessibility/page.tsx`
- `src/app/agents/page.tsx`
- `src/app/api/admin/agents/route.ts`
- `src/app/api/admin/concierge/route.ts`
- `src/app/api/admin/shop/route.ts`
- `src/app/api/agents/apply/route.ts`
- `src/app/api/jobs/[id]/details/route.ts`
- `src/app/api/webhooks/twilio/sms/route.ts`
- `src/app/api/webhooks/twilio/status/route.ts`
- `src/app/api/webhooks/twilio/voice-complete/route.ts`
- `src/app/api/webhooks/twilio/voice/route.ts`
- `src/app/cancel/page.tsx`
- `src/app/contact/layout.tsx`
- `src/app/contact/page.tsx`
- `src/app/custom-quotes/[id]/page.tsx`
- `src/app/dashboard/agent/page.tsx`
- `src/app/feedback/page.tsx`
- `src/app/mover-closed/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/shop/order/[id]/page.tsx`
- `src/app/unsubscribe/page.tsx`
- `src/components/dashboard/move-help.tsx`
- `src/components/layout/public-layout.tsx`
- `src/components/legal/terms-2026-11-18.tsx`
- `src/components/support/support-dialog.tsx`
- `src/lib/business-contact.ts`
- `src/lib/seo.ts`
- `src/lib/server/followups.ts`
- `src/lib/server/jobs.ts`
- `src/lib/server/leads.ts`
- `src/lib/server/move-reminders.ts`
- `src/lib/server/move-sms.ts`
- `src/lib/server/notifications.ts`
- `src/lib/server/service-desk.ts`
- `src/lib/server/shop.ts`
- `src/lib/server/takeover.ts`
- `src/lib/server/twilio-webhook.ts`
- `src/lib/service-requests.ts`

All new application-generated emails pass through `enqueueEmail` and receive the centralized business signature. Historical messages/outbox records were not rewritten. The separate A Moving Service source retains its old number and was not changed.

## Complete source and documentation manifest

- `TWILIO_SETUP.md`
- `TWILIO_VERIFICATION.md`
- `apphosting.yaml`
- `docs/sms-release-checks.md`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `src/app/accessibility/page.tsx`
- `src/app/agents/page.tsx`
- `src/app/api/admin/agents/route.ts`
- `src/app/api/admin/concierge/route.ts`
- `src/app/api/admin/phone/route.ts`
- `src/app/api/admin/shop/route.ts`
- `src/app/api/agents/apply/route.ts`
- `src/app/api/jobs/[id]/details/route.ts`
- `src/app/api/leads/new/route.ts`
- `src/app/api/sms/preferences/route.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/support/route.ts`
- `src/app/api/webhooks/twilio/recording/route.ts`
- `src/app/api/webhooks/twilio/sms/route.ts`
- `src/app/api/webhooks/twilio/status/route.ts`
- `src/app/api/webhooks/twilio/voice-complete/route.ts`
- `src/app/api/webhooks/twilio/voice/route.ts`
- `src/app/book/[providerId]/page.tsx`
- `src/app/cancel/page.tsx`
- `src/app/contact/layout.tsx`
- `src/app/contact/page.tsx`
- `src/app/custom-quotes/[id]/page.tsx`
- `src/app/dashboard/admin/phone/page.tsx`
- `src/app/dashboard/agent/page.tsx`
- `src/app/dashboard/customer/profile/page.tsx`
- `src/app/dashboard/provider/settings/page.tsx`
- `src/app/feedback/page.tsx`
- `src/app/mover-closed/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/provider-signup/page.tsx`
- `src/app/shop/order/[id]/page.tsx`
- `src/app/sitemap.ts`
- `src/app/sms/page.tsx`
- `src/app/terms/[version]/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/unsubscribe/page.tsx`
- `src/components/dashboard/move-help.tsx`
- `src/components/dashboard/provider-text-preferences.tsx`
- `src/components/dashboard/text-preferences.tsx`
- `src/components/forms/quote-form.tsx`
- `src/components/forms/sms-consent.tsx`
- `src/components/layout/employee-layout.tsx`
- `src/components/layout/public-layout.tsx`
- `src/components/legal/terms-2026-11-18.tsx`
- `src/components/marketplace/mover-cart.tsx`
- `src/components/support/support-dialog.tsx`
- `src/lib/business-contact.ts`
- `src/lib/seo.ts`
- `src/lib/server/followups.ts`
- `src/lib/server/jobs.ts`
- `src/lib/server/leads.ts`
- `src/lib/server/move-reminders.ts`
- `src/lib/server/move-sms.ts`
- `src/lib/server/mover-checkout.ts`
- `src/lib/server/mover-orders.ts`
- `src/lib/server/notifications.ts`
- `src/lib/server/service-desk.ts`
- `src/lib/server/shop.ts`
- `src/lib/server/sms-consent.ts`
- `src/lib/server/takeover.ts`
- `src/lib/server/twilio-webhook.ts`
- `src/lib/service-requests.ts`
- `src/lib/sms-consent.ts`
- `src/lib/support.ts`
- `src/lib/terms.ts`
- `tests/marketplace-payments.test.mjs`
- `tests/register-paths.mjs`
- `tests/rules.test.mjs`
- `tests/run-support-integration.mjs`
- `tests/sms-integration.test.mjs`
- `tests/support-integration.test.mjs`
