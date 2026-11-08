# Authenticator MFA

Firebase Authentication with Identity Platform must have optional TOTP MFA enabled
before deploying this code. Keep the project MFA state `ENABLED`, not `MANDATORY`:
customers, employees, and providers choose whether to enroll. Admin access is
enforced separately by Firestore/Storage rules and server role checks using
Firebase's `firebase.sign_in_second_factor` ID-token claim.

## Enrollment and sign-in

1. An admin signs in normally and sees the security setup screen. Their own
   profile remains readable so enrollment and email verification are available.
2. Verify the email address, confirm the password or Google sign-in, then add the
   displayed time-based setup key to an authenticator app.
3. Save a backup key in a secure password manager. Confirm the current code.
4. Sign in again and complete the Firebase MFA challenge. Admin tools now open.

The setup key and codes stay in the browser's temporary component state; they
are sent only to Firebase Auth. They are never written to Firestore, logs,
analytics, or a third-party QR service. Legacy `twoFactorEnabled`/`twoFactorMethod`
profile fields do not establish enrollment or grant admin access.

Security settings support adding a backup authenticator and removing an enrolled
authenticator after reauthentication. Removing the final factor never grants
admin access; the admin must enroll again. Changes end the local session.

## Recovery

Prefer a saved setup key or backup authenticator. If all factors are lost, a
project owner must independently verify the person's identity, then reset their
MFA enrollment with Firebase Console/Admin SDK and revoke their refresh tokens.
The user signs in, enrolls again, and verifies a new MFA sign-in. There is no
public reset endpoint, profile flag, or email-only bypass. Do not ask users to
send passwords, setup keys, or one-time codes through support tickets.

## Deployment and verification

Enable Identity Platform and TOTP first. Deploy the application, then the
Firestore and Storage rules. An older first-factor-only admin session will see
the setup screen and cannot perform privileged actions.

Run `npm run typecheck`, `npm run build`, and the auth/Firestore emulator suite
(`npm run test:support` through `firebase emulators:exec`). The installed Auth
emulator does not implement TOTP: the suite exercises real emulator-issued SMS
MFA tokens for server authorization and explicit TOTP claims in rules tests.
Check real TOTP enrollment, rejection of an incorrect code, sign-in challenge,
reauthentication, and removal using a disposable Firebase Auth account before
rollout. Delete that account afterward. Never enroll a person's real account
on their behalf.
