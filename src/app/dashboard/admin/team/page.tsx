'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Admin = { uid: string; name: string; email: string; grantedBy: string | null; grantedAt: string | null };
type Invite = { email: string; invitedBy: string; invitedAt: string | null };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '');

function Team() {
  const auth = useAuth();
  const { user } = useUser();
  const [data, setData] = useState<{ admins: Admin[]; invites: Invite[] } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => apiFetch<{ admins: Admin[]; invites: Invite[] }>(auth, '/api/admin/team').then(setData).catch(e => setNotice(e instanceof Error ? e.message : 'Could not load the team.')), [auth]);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>, done: (status: string) => string) => {
    setBusy(true); setNotice('');
    try { const r = await apiFetch<{ status: string }>(auth, '/api/admin/team', body); setNotice(done(r.status)); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6 max-w-4xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Team & admins</h1>
      <p className="text-muted-foreground">Admins can see everything: customers, payments, providers and settings. Only add people you trust.</p>
    </div>

    <Card className="bg-white"><CardContent className="p-6 space-y-3">
      <h2 className="font-bold text-lg">Add an admin</h2>
      <form className="flex flex-col sm:flex-row gap-3" onSubmit={e => { e.preventDefault(); const target = email.trim(); void act({ action: 'invite', email: target }, s => s === 'granted' ? `${target} is now an admin.` : `Invite saved. ${target} becomes an admin when they sign in with that email verified (Google sign-in counts).`).then(() => setEmail('')); }}>
        <Input type="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email address" />
        <Button type="submit" disabled={busy}>Add admin</Button>
      </form>
      <p className="text-xs text-muted-foreground">If they already have an account with a verified email, it becomes an admin account right away. Otherwise they get an email and become an admin when they sign in with that address verified (Google sign-in always is).</p>
      {notice && <p role="status" className="text-sm font-medium">{notice}</p>}
    </CardContent></Card>

    {data && data.invites.length > 0 && <Card className="bg-white"><CardContent className="p-6 space-y-3">
      <h2 className="font-bold text-lg">Waiting to sign in</h2>
      {data.invites.map(i => <div key={i.email} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
        <div><p className="font-medium">{i.email}</p><p className="text-xs text-muted-foreground">Invited by {i.invitedBy || 'an admin'} {day(i.invitedAt)}</p></div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void act({ action: 'cancel', email: i.email }, () => `Invite for ${i.email} cancelled.`)}>Cancel invite</Button>
      </div>)}
    </CardContent></Card>}

    <Card className="bg-white"><CardContent className="p-6 space-y-3">
      <h2 className="font-bold text-lg">Admins</h2>
      {!data ? <p>Loading…</p> : data.admins.map(a => <div key={a.uid} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
        <div><p className="font-medium">{a.name || a.email}{a.uid === user?.uid ? ' (you)' : ''}</p><p className="text-xs text-muted-foreground">{a.email}{a.grantedBy ? ` · added by ${a.grantedBy} ${day(a.grantedAt)}` : ''}</p></div>
        {a.uid !== user?.uid && <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm(`Remove admin access for ${a.email}? Their account becomes a customer account.`)) void act({ action: 'remove', uid: a.uid }, () => `${a.email} is no longer an admin.`); }}>Remove admin</Button>}
      </div>)}
    </CardContent></Card>
  </div>;
}

export default function AdminTeamPage() { return <EmployeeLayout isAdmin><Team /></EmployeeLayout>; }
