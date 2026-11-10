'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Row = { id: string; referrer: { name: string; email: string }; referredName: string | null; amountUsd: number; status: 'earned' | 'paid'; createdAt: string | null; paidAt: string | null };

function Referrals() {
  const auth = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try { setRows((await apiFetch<{ referrals: Row[] }>(auth, '/api/admin/referrals')).referrals); }
    catch (e) { setRows([]); setNotice(e instanceof Error ? e.message : 'Could not load referrals.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  async function markPaid(id: string) {
    setBusy(id);
    try { await apiFetch(auth, '/api/admin/referrals', { id }); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(null); }
  }

  const owed = (rows || []).filter(r => r.status === 'earned');
  return <div className="space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Referral rewards</h1>
      <p className="text-muted-foreground">Rewards customers earned when someone they referred booked and paid. Send the reward (gift card, credit or payment), then mark it paid.</p>
      {rows && <p className="font-bold">{owed.length} to send · ${owed.reduce((n, r) => n + r.amountUsd, 0)} owed</p>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="text-muted-foreground">No referral rewards yet. Customers find their referral link on their dashboard.</p> :
      <div className="space-y-3">{rows.map(r => <Card key={r.id} className="bg-white"><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{r.referrer.name || 'Customer'} <span className="font-medium text-muted-foreground">{r.referrer.email}</span></p>
          <p className="text-sm text-muted-foreground">Referred {r.referredName || 'a customer'} · ${r.amountUsd} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}{r.paidAt ? ` · paid ${new Date(r.paidAt).toLocaleDateString()}` : ''}</p>
        </div>
        {r.status === 'earned' ? <Button size="sm" disabled={busy === r.id} onClick={() => void markPaid(r.id)}>Mark paid</Button> : <Badge className="bg-green-100 text-green-800 border-none">Paid</Badge>}
      </CardContent></Card>)}</div>}
  </div>;
}

export default function AdminReferralsPage() { return <EmployeeLayout isAdmin><Referrals /></EmployeeLayout>; }
