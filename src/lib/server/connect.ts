import { stripe } from "@/lib/stripe";
import { adminDb } from "./firebase-admin";
import { HttpError } from "./auth";

/**
 * Stripe Connect onboarding for the signed-in provider. The connected account
 * ID is stored on the provider record by the server only, so a provider can
 * never point payouts at someone else's account.
 */
export async function onboardingLinkFor(uid: string, email: string | undefined, origin: string) {
  const ref = adminDb().doc(`providers/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Finish your provider profile first.");
  let accountId = snap.data()?.stripeAccountId as string | undefined;

  if (!accountId?.startsWith("acct_")) {
    const account = await stripe.accounts.create(
      {
        type: "express",
        email,
        business_profile: { name: String(snap.data()?.businessName || "Independent Provider").slice(0, 100) },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { providerUid: uid },
      },
      { idempotencyKey: `connect-account-${uid}` }
    );
    accountId = account.id;
    await ref.update({ stripeAccountId: accountId, stripeOnboardingComplete: false });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/provider`,
    return_url: `${origin}/dashboard/provider`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function refreshConnectStatus(uid: string) {
  const ref = adminDb().doc(`providers/${uid}`);
  const accountId = (await ref.get()).data()?.stripeAccountId as string | undefined;
  if (!accountId?.startsWith("acct_")) return { connected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
  const account = await stripe.accounts.retrieve(accountId);
  const complete = !!(account.charges_enabled && account.payouts_enabled);
  await ref.update({ stripeOnboardingComplete: complete });
  return {
    connected: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}
