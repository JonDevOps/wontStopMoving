'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Activity = { createdAt: string | null; lastSignInAt: string | null };
export function useAccountActivity(uids: string[]) {
  const auth = useAuth();
  const key = JSON.stringify([...new Set(uids)].sort());
  const [accounts, setAccounts] = useState<Record<string, Activity>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setAccounts({}); setError('');
    const ids: string[] = JSON.parse(key);
    async function load() {
      try {
        const loaded: Record<string, Activity> = {};
        for (let index = 0; index < ids.length; index += 100) {
          const result = await apiFetch<{ accounts: Record<string, Activity> }>(auth, '/api/admin/account-activity', { uids: ids.slice(index, index + 100) });
          Object.assign(loaded, result.accounts);
        }
        if (!cancelled) setAccounts(loaded);
      } catch { if (!cancelled) setError('Account dates could not be loaded.'); }
    }
    if (ids.length) void load();
    return () => { cancelled = true; };
  }, [auth, key]);
  return { accounts, error };
}
