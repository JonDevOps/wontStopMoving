# Two-factor authentication: deferred

2FA is disabled at the site owner's request. Keep [issue #36](https://github.com/wontStopMoving/wontStopMoving/issues/36) open and do not troubleshoot or re-enable it until the owner resumes the work.

The owner reported an "illegal character in the code" error during authenticator setup. Its cause has not been investigated. The previous implementation is preserved in commit `de2ca113320a18682cc0f81ded46d9afd010b757`.

The site uses normal verified Firebase sign-in and Firestore-based role checks. Authenticator setup, dashboard 2FA tasks, and admin MFA enforcement have been removed. Project MFA enrollment is disabled; no user accounts had enrolled factors when this rollback was prepared. Email verification remains separate.

Before re-enabling, test the complete enrollment and sign-in flow in the actual browser UI, including Google sign-in, backup, and recovery. Storage rules that read admin roles from Firestore require the Storage service agent's `roles/firebaserules.firestoreServiceAgent` permission.
