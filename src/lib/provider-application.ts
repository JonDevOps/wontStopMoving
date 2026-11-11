/**
 * Whether a provider still has to fill in the Phase 1 application. Real
 * applications always save a phone number and an onboarding step; accounts
 * created by the old Google sign-in shortcut saved neither, so those
 * providers are sent back to finish the form. Pure logic for unit tests.
 */
export function providerApplicationIncomplete(p: Record<string, unknown> | null | undefined): boolean {
  if (!p) return true;
  if (p.isEmployee === true || p.status !== 'pending') return false;
  return !p.phone && p.onboardingStep == null;
}

/** Where a new Google user who picked "provider" goes to apply. */
export const PROVIDER_GOOGLE_APPLY_PATH = '/provider-signup?google=1';
