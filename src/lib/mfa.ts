/** Only Firebase's verified second-factor claim establishes an MFA session. */
export function hasVerifiedSecondFactor(firebase: { sign_in_second_factor?: unknown } | undefined): boolean {
  return firebase?.sign_in_second_factor === 'totp' || firebase?.sign_in_second_factor === 'phone';
}

export function mfaErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-verification-code') return 'That code is incorrect, expired, or already used. Wait for a new code in your authenticator app and try again.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Your password was not accepted. Please try again.';
  if (code === 'auth/unverified-email') return 'Verify your email address before setting up two-factor authentication.';
  if (code === 'auth/requires-recent-login' || code === 'auth/session-expired' || code === 'auth/invalid-multi-factor-session') return 'This security session expired. Close this window, sign in again, and retry.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait before trying again.';
  if (code === 'auth/network-request-failed') return 'Check your connection and try again.';
  if (code === 'auth/operation-not-allowed') return 'Authenticator setup is not available right now. Please contact support.';
  if (code === 'auth/mfa-cancelled') return 'Verification cancelled. Please sign in again when you are ready.';
  return 'Unable to complete verification. Please try again.';
}
