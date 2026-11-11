'use client';

import { useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Scorecard = {
  id: string; name: string; email: string; status: string; payoutsReady: boolean; state: string; rating: number; reviewCount: number;
  assigned: number; completed: number; cancelled: number; paidOut: number; pendingPayout: number; lastJob: string; claims: number; openClaims: number;
  completionRate: number | null; claimRate: number | null;
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Scorecards() {
  const auth = useAuth();
  const [rows, setRows] = useState<Scorecard[] | null>(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState<'approved' | 'all'>('approved');
  useEffect(() => { apiFetch<{ scorecards: Scorecard[] }>(auth, '/api/admin/scorecards').then(r => setRows(r.scorecards)).catch(e => { setRows([]); setError(e instanceof Error ? e.message : 'Could not load scorecards.'); }); }, [auth]);
  const shown = (rows || []).filter(r => show === 'all' || r.status === 'approved');
  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Provider scorecards</h1>
      <p className="text-muted-foreground">How each provider performs: jobs completed, cancellations, ratings, damage claims and payouts. Watch for low ratings, frequent cancellations or a high claim rate.</p>
      <label className="text-sm font-medium">Show <select className="border rounded-lg p-1.5 ml-1 bg-white" value={show} onChange={e => setShow(e.target.value as typeof show)}><option value="approved">Approved providers</option><option value="all">All providers</option></select></label>
    </div>
    {error && <p role="status">{error}</p>}
    {rows === null ? <p>Loading…</p> : shown.length === 0 ? <p className="text-muted-foreground">No providers to show.</p> :
      <Card className="bg-white"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground border-b">{['Provider', 'Rating', 'Completed', 'Completion', 'Cancelled', 'Claims', 'Paid out', 'Pending payout', 'Last job'].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{shown.map(r => {
            const flag = (r.reviewCount >= 3 && r.rating < 4) || (r.claimRate !== null && r.claimRate >= 10) || (r.completionRate !== null && r.assigned >= 3 && r.completionRate < 70);
            return <tr key={r.id} className={`border-b last:border-0 ${flag ? 'bg-amber-50' : ''}`}>
              <td className="p-3"><p className="font-bold">{r.name}</p><p className="text-xs text-muted-foreground">{r.state || '—'} · {r.status}{r.payoutsReady ? '' : ' · payouts not set up'}</p></td>
              <td className="p-3">{r.reviewCount ? `${r.rating.toFixed(1)}★ (${r.reviewCount})` : '—'}</td>
              <td className="p-3">{r.completed}</td>
              <td className="p-3">{r.completionRate === null ? '—' : `${r.completionRate}%`}</td>
              <td className="p-3">{r.cancelled}</td>
              <td className="p-3">{r.claims}{r.openClaims ? ` (${r.openClaims} open)` : ''}{r.claimRate ? ` · ${r.claimRate}%` : ''}</td>
              <td className="p-3">{money(r.paidOut)}</td>
              <td className="p-3">{r.pendingPayout ? money(r.pendingPayout) : '—'}</td>
              <td className="p-3">{r.lastJob || '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </CardContent></Card>}
    <p className="text-xs text-muted-foreground">Highlighted rows: rating under 4 with 3+ reviews, claims on 10%+ of jobs, or under 70% of assigned jobs completed. Pending payout is completed work not yet paid out automatically (check Stripe & Banking).</p>
  </div>;
}

export default function AdminScorecardsPage() { return <EmployeeLayout isAdmin><Scorecards /></EmployeeLayout>; }
