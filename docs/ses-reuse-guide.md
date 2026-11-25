# Reusing the SES integration for the other businesses

Do this only after WontStopMoving passes the local, mailbox-simulator, feedback and Zoho-rollback checks.

## Per-application checklist

1. Confirm the application's Firebase or Google Cloud project and dedicated runtime service account. Record its email and numeric unique ID; do not reuse WontStopMoving's identity.
2. Review the dormant CloudFormation definitions for that business. Supply its own numeric Google subject only when it is approved to deploy. Verify with IAM policy simulation that only its approved automated sender is allowed and the other business domains are denied.
3. Copy the provider adapter, outbox state model and signed feedback handler. Keep a business-specific SNS topic allowlist and configuration set.
4. Keep the application's current email provider selected during deployment. Add SES identifiers but no AWS access key.
5. Reuse deterministic outbox identifiers and a transaction that claims pending work before sending. Do not create a second outbox for retries.
6. Store only feedback metadata and recipient hashes. Never put authentication tokens, payment codes, message bodies or customer notes in SES tags or logs.
7. Assign each worker a non-overlapping share of the regional SES quota or connect it to a common limiter before enabling it. Separate application Firestore databases do not share quota counters automatically. Use the SES mailbox simulator after approval and keep the pilot suppression records separate from customer suppressions.
8. Verify the old provider still works, present results, and request a separate provider-switch approval.

## Business mapping

| Application | Domain | Configuration set | SNS topic | Role/audience |
| --- | --- | --- | --- | --- |
| A Moving Service | `amovingservice.com` | `amovingservice-transactional` | `amovingservice-ses-events` | `amovingservice-ses-email-worker` |
| W3Develops | `w3develops.org` | `w3develops-transactional` | `w3develops-ses-events` | `w3develops-ses-email-worker` |
| AgentGarden | `agentgarden.org` | `agentgarden-transactional` | `agentgarden-ses-events` | `agentgarden-ses-email-worker` |

The numeric Google service-account subjects are intentionally left as deployment parameters until each application's actual runtime identity is confirmed.

## Future Hermes request endpoint

Hermes should not receive an administrator role, SES permission or an AWS credential. A later application endpoint should:

- authenticate a dedicated Hermes Google OIDC identity;
- allow only pre-approved template IDs, categories and recipient references;
- reject arbitrary From addresses, raw HTML, payment codes and unrestricted recipient lists;
- validate template data server-side and write the same deterministic Firestore outbox record;
- require a human-approved notification record for high-risk or bulk categories;
- enforce per-template and per-recipient rate limits;
- record requester identity, template version and approval ID without storing secrets in logs;
- return only the outbox identifier and state, never provider credentials.

The existing email worker then delivers the approved record using the same suppression, retry, deduplication and feedback controls. Hermes never assumes the AWS email role directly.
