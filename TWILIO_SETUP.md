# WontStopMoving Twilio setup and operation

## Existing infrastructure

This is the existing Next.js application on Firebase App Hosting, not a new Cloud Functions project. Firebase project: `studio-6652665935-1850d`; backend: `wontstopmoving-backend-id`; Firestore `(default)` in `us-central1`. HTTP handlers in `src/app/api` run on the existing hosting backend. `firebase.json` defines no separate Functions codebase. Authentication, Firestore and Storage remain in the existing project; Cloudflare DNS and Zoho email remain unchanged.

Public telephone: **1-888-741-MOVE / 1-888-741-6683 / +18887416683**. Number purchase and account funding were performed by the owner. Registration still requires approval. No additional number or paid service is needed for the work prepared here.

## Safe activation order

1. Deploy the website, consent API, updated rules and policies. Keep all sending/voice switches false.
2. Verify the public URLs in `TWILIO_VERIFICATION.md`. Review the legal registration identity and actual expected message volume with the owner. Obtain approval before submitting the registration.
3. Store the existing account SID and primary Auth Token as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Google Secret Manager through Firebase App Hosting. Grant only this backend’s existing runtime service account access. Never put these in a `NEXT_PUBLIC_` variable, client code, Git, issue, screenshot, email or browser URL.
4. Bind each secret with `availability: [RUNTIME]` in `apphosting.yaml`. The primary Auth Token is required for Twilio’s official webhook signature validator. Do not rotate/create credentials or enable extra services without need.
5. In Twilio’s number configuration use POST `https://wontstopmoving.com/api/webhooks/twilio/sms` for incoming messages. If using a Messaging Service, add only the existing number, configure the same webhook and Advanced Opt-Out, and use `TWILIO_MESSAGING_SERVICE_SID` as a runtime setting. No new number purchase is necessary. Do not change other brand numbers/services.
6. Configure Advanced Opt-Out HELP text to identify WontStopMoving and include support@wontstopmoving.com, 1-888-741-6683, variable frequency/rates and STOP. Leave carrier STOP/START behavior enabled. Confirm Twilio forwards `OptOutType`; if keyword events do not reach the app, STOP synchronization is not verified and activation must wait. Toll-free carriers control their standard STOP response. START/UNSTOP are needed to remove a carrier block; YES is insufficient.
7. **Only after an approved verification status**, set `TWILIO_TOLL_FREE_VERIFIED=true` and `NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED=true`, then rebuild/deploy. Both switches plus valid server-only credentials and the exact official From number are required. `TWILIO_FROM_NUMBER=+18887416683` is already the runtime default in deployment configuration.
8. With the owner’s opted-in test number, test real quote/contact enrollment, private booking code, provider assignment, code redemption/review link, provider payout status, HELP, STOP suppression, START plus fresh consent and delivery receipts. Use synthetic jobs/test payments and no real customer code. A mock test or API acceptance is not proof of handset delivery. Do not send real test messages to customers or providers without authorization.
9. Inspect Admin → Phone inbox for inbound customer support and calls. Staff must monitor this inbox; no unattended AI reply is enabled. After carrier approval, staff can respond through the existing Twilio Console where available. An inbound support message alone does not enroll that number in recurring notifications. Inspect private `smsOutbox` delivery state; `accepted` is distinct from `delivered`. Twilio’s delivery callback is included automatically in outbound requests. Resolve `needs_review` messages manually instead of blindly retrying a possibly delivered text.

## Environment and secrets

| Setting | Purpose | Default / handling |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Account used for API and signature validation | Runtime managed secret |
| `TWILIO_AUTH_TOKEN` | Existing primary Auth Token | Runtime managed secret |
| `TWILIO_FROM_NUMBER` | One official business number | `+18887416683` |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional existing Messaging Service | Runtime only, `MG…` |
| `TWILIO_TOLL_FREE_VERIFIED` | Server approval gate | `false` until verified |
| `NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED` | Existing send/activation switch | `false`, build and runtime |
| `TWILIO_VOICE_ENABLED` | Inbound routing activation | `false` |
| `TWILIO_VOICE_FORWARD_TO` | Owner-selected forwarding destination | Runtime secret; unset |
| `TWILIO_VOICEMAIL_ENABLED` | Recording after disclosed voicemail greeting | `false` |

Webhook verification uses the fixed public origin `https://wontstopmoving.com`, exact route and query, all form parameters, `X-Twilio-Signature`, and the configured account SID. It does not trust forwarded Host headers. Only bounded URL-encoded POST bodies are supported. Local tests sign the public URL using a fake token; no real Twilio keys or sends are used.

## Consent architecture

- Shared disclosure/version: `src/lib/sms-consent.ts`. Optional unchecked `SmsConsent` component used by contact, support, quote, provider application and booking forms. Customer signup does not collect a phone or enroll anyone; the dashboard offers a separate preference form. Employee/agent application and staff intake numbers are not SMS enrollment and do not authorize automated texts.
- Private `smsConsentProfiles/{sha256(subject)}`: subject (`user:UID` or `ticket:ID`), customer ID where known, normalized phone, status/enabled, purpose, source/source page (query/fragment removed), disclosure/version, server consent/opt-out/update timestamps. `history` holds server-written events. Subject IDs are hashed; the records themselves remain sensitive.
- Public contact intake is tied to its support-ticket subject, not silently merged into an account by a matching email/phone. Authenticated account preferences authorize that account’s job events. To receive payment-code texts after a guest enquiry, explicitly opt in at authenticated checkout or in the dashboard.
- `smsSuppressions/{sha256(phone)}` is a global STOP block across customer/provider/support subjects. Web re-enrollment cannot clear STOP; authenticated Twilio START removes the carrier/global block but does not automatically enable old consent profiles. Fresh website enrollment is required.
- STOP mirrors revocation to at most 200 matching profiles per event; the global block immediately protects all matching subjects. APIs calculate effective status from the global block even for records beyond that bounded update. User records are not retroactively fabricated.
- `smsOutbox` is server-only. Every send rechecks consent, suppression, recipient identity, the paid job’s assignment/lifecycle or matching quote/support subject, and a 24-hour freshness limit. Legacy job `smsConsent` or `providerSmsPreferences` booleans alone never authorize dispatch.
- A deterministic event key prevents duplicate sends. Persistent counters cap 1,000 attempted messages/day and 20/hour per destination. `sending` is held after uncertain failure for review; it is never automatically resent. Hourly recovery uses the existing authenticated scheduled route.
- `twilioWebhookEvents` deduplicates inbound MessageSid. `phoneInbox` stores bounded inbound support text/call records; MMS media is counted but not fetched. `phoneRecordings` stores IDs/durations, not public audio URLs. Firestore default-deny rules keep these collections private; owner-only preference APIs and admin-only phone APIs provide access.
- Message delivery callbacks match outbox ID, sender, recipient and MessageSid. Delivery progress cannot regress. Error 21610 also suppresses future sending.

## Voice activation independent of pending SMS verification

The same number supports voice independently of SMS verification. On November 18, 2026 the owner authorized voice activation and supplied a forwarding destination, stored only as the runtime secret `TWILIO_VOICE_FORWARD_TO`. The incoming voice webhook was verified as POST to the voice route; incoming SMS webhook was preserved. SMS verification is In Review per the owner. Voicemail and recording remain disabled. Firebase rollout `build-2026-11-18-002` succeeded and is serving. Live runtime confirms voice enabled, forwarding secret bound, SMS approval/sending gates false and voicemail false. A signed no-answer request returned 200 with Hangup and no Record; unauthenticated admin inbox API returned 401. The browser was not signed in as admin. Actual handset routing and the resulting admin inbox entry require the owner’s incoming-call test.

**November 25, 2026:** the direct-dial flow above was replaced by the phone menu and hold queue described below (#194).

1. Ask the owner for the forwarding destination. Do not assume the previous public number is still their preferred destination. Do not forward back to +18887416683 (loop).
2. Put the destination in `TWILIO_VOICE_FORWARD_TO`, enable `TWILIO_VOICE_ENABLED`, deploy and set the number’s incoming Voice webhook to POST `https://wontstopmoving.com/api/webhooks/twilio/voice`.
3. **Call flow (phone menu):**
   - **Blocked numbers** (Admin → Phone → Block number) are rejected.
   - **Customers and providers on file** (matched on `users.phone`) are greeted by name and skip the menu: providers go to dispatch, customers to support.
   - **Everyone else** hears: "Thank you for calling Wont Stop Moving. To book a move, press 1. For service provider dispatch, press 2. For customer support, press 0." Pressing nothing twice is logged as `likely_spam` and the call ends, which stops most robocalls.
   - **After a choice,** the caller hears "Your call is important to us. Please remain on the line for the next available representative." They then wait in their own hold queue, listening to `public/audio/hold-music.wav` (an original 30-second instrumental loop) with the wait message repeated about every 30 seconds.
   - **At the same time, Twilio calls `TWILIO_VOICE_FORWARD_TO` from the business number.** On answer, a whisper reads the caller's number (and name, if they're on file) and their menu choice, then says "Press 1 to connect". A personal voicemail never presses 1, so it can't swallow the call.
   - **Unanswered after 90 seconds,** the caller leaves the queue and hears the callback message (or voicemail, if enabled).
   - **Every call is logged** in `phoneInbox` with its status (`answered`, `missed`, `caller_hung_up`, `likely_spam`, `blocked`). Admin → Phone shows a **Call back** list with call-back and block buttons.
   - **Cost:** toll-free inbound minutes are billed while the caller is in the menu and on hold. The outbound leg to the owner's phone is billed only once answered. A full 90-second hold is about 1.5 inbound minutes.
4. With voicemail disabled, unanswered calls give the website/email and hang up. To enable voicemail, first review the explicit recording announcement and record-access/retention practice with the owner, then set `TWILIO_VOICEMAIL_ENABLED=true`. Recording max 120 seconds, no automatic transcription. Store only recording IDs in Firebase; review audio in authenticated Twilio. Enable Twilio media HTTP Basic Auth protection and establish a deletion schedule before activating recording. Do not record bridged live calls by default.
5. Test answer, no-answer, busy, rejected-call and voicemail paths from the owner’s phone. Verify actual call routing before calling the business phone migration operationally complete.
6. Outgoing business calls can use the existing verified number as caller ID through Twilio’s approved calling workflow. This release does not create an unattended dialer or auto-call customers. A future app calling interface must require staff/admin authorization, an explicit call action, rate/spend limits and allowlisted bridge destinations. There is no public arbitrary destination endpoint.

## Hermes integration

Hermes is not connected or active. Add it behind the existing server authorization boundary when its actual endpoint/authentication is available. Start with read-only job context and proposed replies for human review; exclude payment-code secrets, raw SMS consent records and payment credentials. Use an admin-only dispatch action for changes, preserve audit history, and route all text through this existing consent/suppression outbox. Never let a language model call Twilio directly or choose unrestricted recipients. Live voice streaming, transcription, autonomous outbound calls, additional paid services and call recording require separate owner approval and a reviewed disclosure/retention design.

## Business contact and email configuration

`src/lib/business-contact.ts` is the source of truth. `SITE_PHONE` and JSON-LD derive from it. Public buttons, page metadata, vCard, support surfaces, operational email templates and future draft outreach use it. New application emails receive `BUSINESS_EMAIL_SIGNATURE` through `enqueueEmail`; existing sent messages or stored historical outbox content are not rewritten. Zoho SMTP sender/aliases, DNS and mailbox identity remain unchanged.

Completed in Zoho Mail on November 18, 2026: created WontStopMoving signature and associated both existing sender aliases (`contact@wontstopmoving.com`, `noreply@wontstopmoving.com`) for new messages and replies/forwards. Verified automatic insertion for both in a new unsent draft, including telephone, email and HTTPS links. Primary mailbox and other-business signature were preserved; no aliases, DNS or reply-address preferences were changed. `support@wontstopmoving.com` is the signature contact but was not listed as an existing sender alias; none was created. Reference steps: sign into Zoho Mail as the existing mailbox → Settings → Signatures → select the WontStopMoving signature (or add one) → paste the following → associate it with the existing WontStopMoving From aliases → save. Keep jonathan@w3develops.org as the primary mailbox and keep reply-from-receiving-alias behavior. Do not attach this brand signature to unrelated A Moving Service or W3Develops aliases.

```
WontStopMoving
A Moving Service Inc.
1-888-741-MOVE (1-888-741-6683)
support@wontstopmoving.com
https://wontstopmoving.com
```

The separate accessible A Moving Service source (`aMovingService/src/App.tsx`) still lists `(415) 214-5474` and `tel:+14152145474`. It was inspected, not modified. Confirm separately whether that brand should also migrate.

## Existing lead workflows and legal review items

- Admin registry/recruiting, partner introductions, referral attribution, quote follow-up email and closed-mover outreach are existing features. None is permission to use another business’s SMS consent. The outreach generation prompt now explicitly rejects purchased/transferred SMS consent and cold recruitment through this informational program. Draft scripts are not automatic messages.
- Review the previous November 8 terms’ generic 48-hour cancellation/deposit language and blanket valuation/damage clauses against actual provider agreements. No verified fee schedule, uniform coverage policy or blanket liability waiver was available. The new November 18 terms avoid inventing those commitments and preserve the old document for accepted historical versions. Owner review of service-specific agreements remains necessary.
- Confirm the retention periods for recordings, inbound support and consent evidence; no automatic deletion guarantee is made. Configure Twilio’s own data retention/redaction settings before going live.
- Payment-code, refund and tip money flows remain unchanged. This task does not change Stripe accounts, schedules, payment permissions or city direct-booking routes.
