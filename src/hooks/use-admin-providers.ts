'use client';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { isPendingProvider, providerCreatedMillis } from '@/lib/provider-status';

/** Include legacy applications without createdAt; Firestore orderBy would exclude them. */
export function useAdminProviders() {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => firestore ? collection(firestore, 'providers') : null, [firestore]);
  const result = useCollection(ref);
  const providers = result.data ? [...result.data].sort((a, b) =>
    providerCreatedMillis(b) - providerCreatedMillis(a) || a.id.localeCompare(b.id)) : [];
  return { ...result, providers, pendingProviders: providers.filter(p => isPendingProvider(p.status)) };
}
