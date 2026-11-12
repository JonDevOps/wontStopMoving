'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { BACKGROUND_STATUSES, type BackgroundStatus, type Issue, type MoverProfile } from '@/lib/mover-profile';

type Mover = { uid: string; name: string; email: string; status: string; stripeReady: boolean; profile: MoverProfile & { backgroundConsentAt: string | null }; issues: Issue[]; blocking: boolean };

function Credentials() {
  const auth = useAuth();
  const [movers, setMovers] = useState<Mover[] | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try { setMovers((await apiFetch<{ movers: Mover[] }>(auth, '/api/admin/credentials')).movers); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not load.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  const setBackground = async (uid: string, backgroundStatus: BackgroundStatus) => {
    try { await apiFetch(auth, '/api/admin/credentials', { uid, backgroundStatus }); setNotice('Saved.'); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
  };
  const blocked = (movers || []).filter(m => m.blocking).length;
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-black text-primary uppercase">Mover credentials</h1>
        <p className="text-muted-foreground">License, insurance and background checks for every mover. Movers keep these up to date themselves; record background check results here after ordering them with your screening provider.</p>
        {movers && <p className="font-bold mt-2">{blocked} of {movers.length} movers have something blocking new jobs</p>}
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!movers ? <p>Loading…</p> : <ul className="space-y-3">{movers.map(m => (
        <li key={m.uid} className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-bold">{m.name || m.email} {m.blocking ? <Badge className="bg-red-100 text-red-800 border-none">blocked</Badge> : <Badge className="bg-green-100 text-green-800 border-none">ready</Badge>}</p>
              <p className="text-xs text-muted-foreground">{m.email} · {m.status}{m.profile.usdot ? ` · USDOT ${m.profile.usdot}` : ''}{m.profile.insuranceExpires ? ` · insurance to ${m.profile.insuranceExpires}` : ''} · payouts {m.stripeReady ? 'ready' : 'not set up'}</p>
            </div>
            <select aria-label={`Background check for ${m.name}`} className="h-9 rounded-md border px-2 text-sm bg-white" value={m.profile.backgroundStatus} onChange={e => void setBackground(m.uid, e.target.value as BackgroundStatus)}>
              {(Object.keys(BACKGROUND_STATUSES) as BackgroundStatus[]).map(s => <option key={s} value={s}>{BACKGROUND_STATUSES[s]}</option>)}
            </select>
          </div>
          {m.issues.length > 0 && <ul className="text-xs list-disc pl-5">{m.issues.map(i => <li key={i.field + i.message} className={i.blocking ? 'text-red-700' : 'text-amber-700'}>{i.message}</li>)}</ul>}
        </li>
      ))}</ul>}
    </div>
  );
}

export default function AdminCredentialsPage() { return <EmployeeLayout isAdmin><Credentials /></EmployeeLayout>; }
