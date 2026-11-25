# WontStopMoving SES pilot

The rollout starts with WontStopMoving on its existing Firebase App Hosting backend and Firestore database. Zoho handles correspondence and inbound replies. The first deployment keeps all automated email on Zoho. A later configuration change routes the approved `job`, `release_code`, and `review` categories to SES. Booking emails in `job` include notices to the customer, assigned crew and operations. Other messages, such as quotes and account approvals, continue through Zoho.

## Pilot deployment record

- On November 23, 2026 (Pacific), App Hosting deployed `wontstopmoving-backend-id-build-2026-11-24-001` with Zoho active. The source upload was based on the then-live Git commit `4e1ed8455dd42e52bce854b1bf028992f116e8df`, with only the SES changes applied. The 145 tests for that release passed. Include those SES changes in the next repository-based deployment to keep this configuration.
- CloudFormation stack `wontstopmoving-ses-pilot` completed in `us-east-2`, including the confirmed HTTPS SNS subscription. AWS policy simulation allowed the intended sender and configuration set and denied other business identities and the support alias. The Google service-account binding grants only OpenID token creation to the existing App Hosting identity.
- Both Firestore indexes are ready. The `email-outbox` scheduler is enabled with the production URL as the OIDC audience. Its first authenticated execution returned HTTP 200. The public homepage returned 200, unsigned SNS requests returned 400, and unauthenticated scheduler requests returned 401.
- Simulator run `wsm-20261123-sim-01` sent one message to each of Amazon’s three test addresses through the dedicated federated sender role. Signed SNS callbacks recorded `delivered`, `bounced`, and `complained` in Firestore. The bounce and complaint created pilot-only suppression records. No simulator address was on the customer suppression list after the run. The temporary operator grant was removed and the Firebase runtime binding was verified afterward.
- The owner-inbox run `wsm-20261123-inbox-01` sent one message to the approved Zoho address. SES reported delivery through the signed SNS callback, and the temporary operator grant was removed. The message landed in the Zoho Inbox. Zoho reported SPF, DKIM and DMARC pass, and the original headers show `Reply-To: support@wontstopmoving.com`.
- On November 23, 2026 (Pacific), the approved SES activation deployed as `wontstopmoving-backend-id-build-2026-11-24-002` and received 100% of traffic. Only `job`, `release_code`, and `review` route to SES. The site and first post-cutover scheduled run returned HTTP 200. Other mail stays on Zoho. The previous Zoho revision is `wontstopmoving-backend-id-build-2026-11-24-001`.

## Exact deployment proposal

| Order | System | Change |
| --- | --- | --- |
| 1 | Google Cloud, project `studio-6652665935-1850d` | Create keyless `wsm-ses-email-worker`. Give the App Hosting runtime `firebase-app-hosting-compute@studio-6652665935-1850d.iam.gserviceaccount.com` the `roles/iam.serviceAccountOpenIdTokenCreator` role on that service account only. The IAM Service Account Credentials API is already enabled. |
| 2 | AWS account `454005357454`, `us-east-2` | Create CloudFormation stack `wontstopmoving-ses-pilot` with five resources: SES configuration set `wontstopmoving-transactional`, its event destination `sns-transactional-events`, SNS topic `wontstopmoving-ses-events` and its SES publish policy, and IAM role `wontstopmoving-ses-email-worker`. Set the Google subject to the new service account’s numeric ID. Keep `CreateWontStopMovingSubscription=false` and `EnableWontStopMovingReputationMetrics=false`. |
| 3 | Firebase | Deploy the two `emailOutbox` composite indexes and App Hosting backend `wontstopmoving-backend-id`, with `EMAIL_DELIVERY_PROVIDER=zoho`. The backend exposes the signed SNS feedback endpoint and the Google-authenticated outbox scheduler endpoint. Review the deployment diff against the deployed source so unrelated worktree edits stay out. |
| 4 | AWS and Google Cloud | After the callback is deployed, update the stack to add one HTTPS subscription to `https://wontstopmoving.com/api/webhooks/aws/ses`. Create a one-minute `email-outbox` Cloud Scheduler job in `us-central1`, POSTing to `https://wontstopmoving.com/api/cron/email-outbox` with the existing scheduler identity and exact URL as token audience. |
| 5 | Controlled pilot sends | After separate approval, run three SES mailbox-simulator sends. Then send one approved email to the owner inbox and check receipt, SPF, DKIM, DMARC and reply routing. |
| 6 | Activation | After approval of pilot results, set `EMAIL_DELIVERY_PROVIDER=ses` for the three allowlisted categories. |

The worker identity can obtain a Google OIDC token for the dedicated service account through its one permission. The AWS trust policy requires the dedicated account’s exact Google `sub` and `aud` (mapped from `azp`), and `oaud=wontstopmoving-ses-email-worker`. The application exchanges that token for a 15-minute AWS session. It can call only `ses:SendEmail` from `noreply@wontstopmoving.com` with the scoped SES identity and configuration-set resources. The adapter explicitly supplies the configuration set on every send. Setting a default on the existing SES identity would be a separate optional change.

The dedicated identity isolates the AWS trust mapping and provides a narrow revocation point. The current App Hosting runtime still initiates email and receives permission to mint this one identity’s ID tokens. This design does not create a separate compute service or grant the dedicated identity Firestore access. [Google service account permissions](https://docs.cloud.google.com/iam/docs/service-account-permissions)

The AWS template retains dormant definitions for A Moving Service, W3Develops and AgentGarden. Each requires its own explicit numeric Google subject to create its resources. The pilot uses the existing verified SES domain, existing account-level suppression and existing DNS, Zoho, Stripe and Twilio configuration. The optional CloudWatch alarm and budget template is a separate decision.

## Delivery behavior

- Firestore claims each message once per attempt and reserves SES quota in the same transaction. An attempt ID correlates the send response with signed SNS callbacks. A delivery event received early wins over the API response. Late delay and acceptance events cannot move a confirmed delivery backward. A later verified bounce or complaint can supersede it.
- An explicit SES throttle retries up to five total attempts with backoff. Timeouts, HTTP 503 and other uncertain responses, and expired leases enter administrator review. Only act after verifying whether delivery occurred. SES sends are never automatically retried through Zoho. The scheduler processes only entries with a due timestamp. Older pending entries stay available for individual review.
- Permanent bounces and complaints suppress only the matched recipient. Feedback must match the allowlisted topic, valid signature version 2, business, configuration set, attempt, outbox ID, destination, and SES message ID when known. The callback returns a retryable error on storage failure. Payment codes stay in the private customer message body and dashboard. Feed records contain recipient hashes and delivery metadata.
- `emailDeliveryControls/settings` accepts `sesPaused: true` to pause new SES claims. Admin Emails shows the pause state. Optional lower limits are `sesPerSecond`, `sesBusinessLimit`, and `sesAccountLimit`. The defaults and maxima are four reservations per second, 1,000 WontStopMoving reservations, and 5,000 shared reservations over a conservative 24–25 hour window. These are application safeguards for workers using the same ledger, not global AWS enforcement. Future apps must share a limiter or receive explicit non-overlapping shares of the AWS quota before sending.

## Runtime configuration

```text
EMAIL_DELIVERY_PROVIDER=ses
SES_EMAIL_CATEGORIES=job,release_code,review
SES_AWS_REGION=us-east-2
SES_CONFIGURATION_SET=wontstopmoving-transactional
SES_ASSUME_ROLE_ARN=arn:aws:iam::454005357454:role/wontstopmoving-ses-email-worker
SES_WEB_IDENTITY_AUDIENCE=wontstopmoving-ses-email-worker
SES_GOOGLE_SERVICE_ACCOUNT=wsm-ses-email-worker@studio-6652665935-1850d.iam.gserviceaccount.com
SES_ALLOWED_SNS_TOPIC_ARNS=arn:aws:sns:us-east-2:454005357454:wontstopmoving-ses-events
EMAIL_FROM_ADDRESS=Wont Stop Moving <noreply@wontstopmoving.com>
EMAIL_REPLY_TO=support@wontstopmoving.com
```

## Costs

SES Essentials is $0.16 per 1,000 recipients at these volumes. An assumed 32 KB per email adds about $0.00384 per 1,000. Confirm that the account is still on Essentials before deployment. The previously audited production quota was 50,000 recipients per 24 hours and 14 per second. The current AWS CLI session needs reauthentication to verify that account state.

| Monthly SES recipients | Estimated SES cost |
| ---: | ---: |
| 1,000 | $0.16 |
| 10,000 | $1.64 |
| 20,000 | $3.28 |
| 50,000 | $8.19 |

The last row illustrates pricing at higher volume. It would require reviewing the WontStopMoving pilot cap first. AWS IAM and the configuration set add no fixed monthly fee. At two events per message, SNS is within its published free allowance if the account has it available. The SNS request and HTTPS delivery charges at 100,000 each would be about $0.11 before transfer, redelivery or free allowances. This proposal adds one Cloud Scheduler job at approximately $0.10 per 31 days because the project already has four. Firestore and App Hosting charge according to existing billing allowances and actual usage. The baseline estimated Firestore reads and writes at 10,000 emails are under $0.15 before free allowances, excluding unusual retries, storage and other app traffic.

The core AWS template leaves paid per-configuration-set metrics disabled. Review the SES account dashboard and the outbox for bounces and complaints during the pilot. The optional WontStopMoving monitoring proposal would export two CloudWatch metrics and create two alarms, estimated at up to $0.80 per month before allowances. Its notification-only AWS Budget does not cap spending.

## Verification and test operation

Local validation passed 155 tests, including the Firestore emulator suite and the two SES infrastructure tests. The build, type check and CloudFormation lint passed. ESLint reported zero errors and 306 repository warnings. The npm audit reported 18 findings, with two high-severity findings in the existing Next.js/PostCSS and Zod dependencies. The new SES SDK and SNS validator dependencies had no reported findings. The simulator run verified AWS federation, authorized sending and signed SNS delivery. The owner-inbox test will verify SPF, DKIM, DMARC and reply routing.

Before deployment, refresh AWS CLI authentication for profile `w3develops`. Verify account and region, identity authentication and suppression, quota, proposed resource names and the CloudFormation change set. Simulate the template policy with the approved sender, a different local alias, and each other business domain. Pilot deployment also checks that the exact Google identity can obtain a scoped role session. No data or secrets from credentials should be printed.

The approved test operator uses Google Application Default Credentials with access to the WontStopMoving Firestore database and a temporary, service-account-specific OpenID-token grant if needed. Remove that temporary grant after the pilot tests. Set `GCLOUD_PROJECT=studio-6652665935-1850d` plus the SES identifiers above. The simulator command requires `SES_SIMULATOR_APPROVED=true` and a unique `SES_SIMULATOR_RUN_ID`. Run `npm run test:ses-simulator` to send to Amazon’s success, bounce, and complaint simulator addresses. For the separately approved owner email, use a separate run ID, set `SES_REAL_INBOX_APPROVED=true`, and run `npm run test:ses-simulator -- --owner-inbox`. The owner address is fixed in the script.

The test records live in `sesPilotOutbox` and `sesPilotSuppressions`, and carry a pilot label in SNS event records. They contain no customer data or payment code. Repeating an already accepted run ID leaves that attempt in place. Confirm delivery, bounce and complaint outcomes in Firestore, and confirm customer suppression records stay unchanged. Use the local fixtures to test duplicate callbacks, out-of-order status events, ambiguity and throttling. While the app still uses Zoho, verify the notification configuration and ordinary replies.

## Rollback

Set `EMAIL_DELIVERY_PROVIDER=zoho` and roll out the updated configuration. For immediate SES containment, set `sesPaused: true` in the existing Firestore database or disable sending on the SES configuration set. Sends already in flight may finish. Keep SNS connected to record pending feedback and retain the outbox and suppression records. Inspect ambiguous attempts before manually resending. Leave the Cloud Scheduler job enabled for lease recovery and Zooho queue work, or pause it if the queue itself is under investigation.

## Pricing and service references

- [Amazon SES pricing](https://aws.amazon.com/ses/pricing/)
- [Amazon SNS pricing FAQ](https://aws.amazon.com/sns/faqs/)
- [Cloud Scheduler pricing](https://cloud.google.com/scheduler/pricing)
- [Cloud Firestore pricing](https://cloud.google.com/firestore/pricing)
- [Firebase App Hosting costs](https://firebase.google.com/docs/app-hosting/costs)
- [SES sender reputation](https://docs.aws.amazon.com/ses/latest/dg/monitor-sender-reputation.html)
- [Amazon CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
