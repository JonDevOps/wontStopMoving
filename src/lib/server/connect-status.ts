import type { Firestore } from 'firebase-admin/firestore';

type AccountStatus = { id: string; charges_enabled?: boolean; payouts_enabled?: boolean };

/** Resolve ownership from the server's saved account ID, never event metadata.
 * Fetch current Stripe state so a retried old snapshot cannot regress readiness.
 */
export async function syncConnectedAccountStatus(
  db: Firestore,
  accountId: string,
  retrieveAccount: (id: string) => Promise<AccountStatus>,
) {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error('Invalid connected account.');
  const providers = await db.collection('providers').where('stripeAccountId', '==', accountId).limit(2).get();
  if (providers.empty) return;
  if (providers.size !== 1) throw new Error('Connected account is linked to multiple providers.');
  const ref = providers.docs[0].ref;
  await db.runTransaction(async tx => {
    const provider = await tx.get(ref);
    if (!provider.exists || provider.data()?.stripeAccountId !== accountId) return;
    const current = await retrieveAccount(accountId);
    if (current.id !== accountId) throw new Error('Connected account did not match.');
    tx.update(ref, { stripeOnboardingComplete: !!(current.charges_enabled && current.payouts_enabled) });
  });
}
