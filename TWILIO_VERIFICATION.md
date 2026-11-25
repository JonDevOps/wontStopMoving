# WontStopMoving toll-free verification

Prepared November 18, 2026. Do not submit until deployment verification below is complete and the owner approves the final registration. This document contains no credentials, EIN or private registration data.

## Number and business identity

- Registered sender to verify: **+18887416683** — **1-888-741-MOVE (1-888-741-6683)**.
- Business legal name supplied by the owner: **A Moving Service Inc.**
- Customer-facing brand/program: **WontStopMoving**.
- Business website: **https://wontstopmoving.com**.
- Support contact: **support@wontstopmoving.com**, **1-888-741-6683**.
- Do not claim a registered DBA. The owner must use the exact legal name, registration/EIN, address and authorized representative matching the existing compliance profile. These private values are not reproduced here and must be verified by the owner before submission.

## Compliance review — November 18, 2026

**Submission hold:** The registration answers below are a draft, not evidence of Twilio submission or approval. Do not submit them unchanged while the review-reward SMS classification remains unresolved. Automated SMS stays disabled (`NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED=false`, `TWILIO_TOLL_FREE_VERIFIED=false`).

- The actual completion SMS in `src/lib/server/notifications.ts` mentions the $5 review refund and optional tipping. Twilio distinguishes informational transaction notices from promotional messages, including discount announcements. My assessment is that this reward wording creates a promotional-classification risk; Twilio has not specifically ruled on this program. The current categorical “no promotional SMS” claim and instruction to avoid marketing must not be relied on without resolving this.
- Conservative proposed SMS: “WontStopMoving: Your crew’s payment code was accepted. View your completed job and leave feedback at https://wontstopmoving.com/dashboard/customer/moves/[jobId]. Reply STOP to opt out.” Keep refund eligibility, the $5 refund offer and optional tipping in the authenticated dashboard and email. This is a proposed wording change only: the running template has not been changed by this review. Before submission, update and test the actual template and align the samples, or obtain Twilio guidance and accurately register the mixed content with appropriate consent.
- Provider notification consent is separate: the application starts its checkbox unchecked and uses `PROVIDER_SMS_DISCLOSURE`, covering new jobs, appointments, job updates, accepted codes and payouts. The server records provider-specific disclosure and source evidence. Include https://wontstopmoving.com/provider-signup as additional opt-in proof, with an empty screenshot showing that checkbox and Terms/Privacy links. Customer consent never enrolls providers or authorizes their own marketing. Do not use this program for cold recruiting.
- Provider consent is stored under the account subject with a provider marker; sending authorization currently checks consent/version/phone and suppression rather than a distinct purpose per event. Review dual-role or changed-role accounts before activation so customer-only consent cannot be reused for provider alerts.
- Keep the existing honest-review refund independent of star rating. The review form discloses the incentive and the server labels incentivized reviews. FTC guidance requires clear incentive disclosure and prohibits making rewards conditional on positive sentiment. Marketplace payment, refund and tip code was left intact.
- Before activation, obtain approved verification, resolve the content classification, verify provider opt-in proof and role scope, configure/verify STOP and HELP behavior, and perform owner-authorized delivery tests. A paid balance is not approval.

Sources reviewed: [Twilio Messaging Policy](https://www.twilio.com/en-us/legal/messaging-policy), [Twilio consent-sharing rejection guidance](https://www.twilio.com/docs/api/errors/30477), [FTC review incentive guidance](https://www.ftc.gov/business-guidance/resources/soliciting-paying-online-reviews-guide-marketers).

## Draft registration answers — resolve review above before use

**Opt-in type:** Web Form.

**Opt-in policy proof URL:** https://wontstopmoving.com/contact#sms-consent

**Additional public explanation:** https://wontstopmoving.com/sms

**Terms and conditions URL:** https://wontstopmoving.com/terms

**Privacy policy URL:** https://wontstopmoving.com/privacy

**Opt-in workflow description:**

Customers enter their own mobile number on WontStopMoving’s contact, moving quote or booking form and may select a separate, unchecked SMS consent checkbox. The checkbox is optional and includes the business name, informational moving purposes, variable message frequency, message/data rates, STOP and HELP instructions, and clickable Terms and Privacy links. Customers can submit an enquiry, request an estimate or purchase moving services without selecting it. Consent is recorded server-side with the phone in E.164 format, customer or intake reference, timestamp, source page, purpose and disclosure version. Account users can update or revoke text preferences in their dashboard. Existing customers are not automatically enrolled. Provider job alerts require a provider’s own separate optional checkbox. STOP suppresses future texts. No purchased lists, transferred SMS consent or promotional SMS are included.

**Messaging use case / additional program information:**

WontStopMoving, operated by A Moving Service Inc., sends first-party informational texts requested by customers concerning moving estimates and quote requests, paid booking confirmations and private per-crew payment codes, appointment reminders, moving-day updates, customer support and a post-move review invitation after payment-code redemption. Providers who separately opt in receive new paid-job, appointment, payment-code-accepted and payout-status notifications for their assigned jobs. SMS consent is optional and separate from general terms and email preferences. Messages identify WontStopMoving and include opt-out instructions. Payment codes are sent only to the customer, never included in provider job notifications. Email and dashboards remain available without SMS. We do not sell or transfer SMS opt-in data, use purchased lead lists or send promotional/recruitment campaigns through this number. Automated sending remains disabled until toll-free verification is approved.

**Use-case category:** Select the closest available customer care / account notification / appointment reminder category. Do not select marketing or lead generation for this program.

**Estimated monthly volume:** Owner to confirm from expected opted-in bookings and support volume; do not invent existing traffic. Each crew can generate confirmation/code, reminder, completion/review and provider-alert texts. Long texts can use multiple billable segments. The daily application ceiling is 1,000 attempted messages and the per-number hourly ceiling is 20, not a forecast of expected usage.

**Age-gated content:** No.

**Purchased, rented, sold or third-party SMS consent:** No.

## Sample messages

Samples use fictional dates and demonstration details. Replace bracketed values only in actual authenticated event handling, never send these as live customer bookings. A carrier may send its own STOP/START reply; the application avoids duplicate keyword replies when Twilio Advanced Opt-Out already responded.

1. **Moving quote confirmation**
   WontStopMoving: Your moving quote request has been received. Review it at https://wontstopmoving.com/dashboard/customer/quotes. Reply HELP for assistance or STOP to opt out.

2. **Booking confirmation and private code**
   WontStopMoving: Your moving crew is booked for December 15. Your private payment code is 123456 (demonstration only). Give it only to this crew after their work is complete. View your job in your WontStopMoving dashboard. Reply STOP to opt out.

3. **Appointment reminder**
   WontStopMoving: Your move is tomorrow (December 15). Confirm the time and view details in your WontStopMoving job dashboard. Keep your payment code private until the crew finishes. Reply HELP for help or STOP to opt out.

4. **Moving-day update**
   WontStopMoving: Your move details have been updated. Review them in your WontStopMoving job dashboard. Reply HELP for help or STOP to opt out.

5. **Customer support acknowledgement**
   WontStopMoving: Your support request has been received. Our team will reply by email. Help: support@wontstopmoving.com. Reply STOP to opt out.

6. **SMS opt-in confirmation**
   WontStopMoving: You opted in to informational moving texts. Message frequency varies. Msg/data rates may apply. Reply HELP for help or STOP to opt out.

7. **HELP response**
   WontStopMoving: Help at support@wontstopmoving.com or 1-888-741-6683. Message frequency varies. Msg/data rates may apply. Reply STOP to opt out.

8. **STOP response**
   You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.

   The toll-free carrier controls this response; this is a representative example, not a custom reply the app sends. Our webhook stores STOP and returns empty TwiML to avoid a second confirmation. After START unblocks the number, our application still requires fresh website enrollment.

9. **Provider new-job alert**
   WontStopMoving: New paid loading job on December 15. Review the job and confirm the start time in your provider dashboard. Reply STOP to opt out.

10. **Customer completion/review invitation**
   WontStopMoving: Your crew’s payment code was accepted. Review your move in your job dashboard. Any honest star rating qualifies for a $5 refund to your original payment method on eligible jobs. Optional tipping is available after your review. Reply STOP to opt out.

11. **Provider code acceptance**
   WontStopMoving: The payment code for your job was accepted. Your payout is awaiting processing or support follow-up. View your provider dashboard. Reply STOP to opt out.

   When a transfer is confirmed, the actual message instead states that the 85% payout was sent to the connected Stripe account and bank arrival may take longer.

## Verification evidence and limitations

- Public contact checkbox is the actual enrollment form, not a mock checkbox.
- Use the deployed URL only after checking a 200 response and visible unchecked consent, Terms and Privacy links on desktop and mobile. A local preview is not public proof.
- Do not enter real customer data into a verification screenshot. The form can be shown empty.
- Latest official references reviewed: [required information](https://help.twilio.com/hc/en-us/articles/13264118705051-Required-Information-for-Toll-Free-Verification), [missing opt-in 30476](https://www.twilio.com/docs/api/errors/30476), [sharing 30477](https://www.twilio.com/docs/api/errors/30477), [optional opt-in 30505](https://www.twilio.com/docs/api/errors/30505), [console guide](https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding), [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).
- The required-information help article loads through JavaScript. Official error documentation independently confirms public proof, optional consent and the prohibition on transferring opt-in data. The registration form requires separate public Terms and Privacy URLs; provide both above.
- Prepared answers do not mean a registration has been submitted or approved. Do not enable sending based only on a paid balance, number purchase, or pending application.
