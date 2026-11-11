'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getDownloadURL, ref } from 'firebase/storage';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { initializeFirebase, useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { RESPONSE_TARGET_HOURS, SERVICE_REQUEST_LABELS, waitStatus, type ServiceRequestType } from '@/lib/service-requests';

type Row = {
  id: string; type: ServiceRequestType; status: 'open' | 'in-progress' | 'resolved'; jobId: string; customerName: string; customerEmail: string; customerPhone: string;
  moveDate: string; reason: string; requestedDate: string | null; item: string | null; estimatedValue: number | null; photoPaths: string[];
  adminMessage: string | null; satisfaction: number | null; createdAt: string | null; resolvedAt: string | null; overdue: boolean;
};
type Metrics = { open: number; overdue: number; claimsOpen: number; satisfactionPercent: number | null; satisfactionCount: number };

function Photos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const { storage } = initializeFirebase();
    Promise.all(paths.map(p => getDownloadURL(ref(storage, p)).catch(() => ''))).then(u => setUrls(u.filter(Boolean)));
  }, [paths]);
  if (!paths.length) return null;
  return <div className="flex flex-wrap gap-2">{urls.length ? urls.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="Claim photo" className="h-24 w-24 object-cover rounded-lg border" /></a>) : <span className="text-xs text-muted-foreground">Loading {paths.length} photo(s)…</span>}</div>;
}

function ServiceDesk() {
  const auth = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ requests: Row[]; metrics: Metrics }>(auth, '/api/admin/service-requests'); setRows(r.requests); setMetrics(r.metrics); }
    catch (e) { setRows([]); setNotice(e instanceof Error ? e.message : 'Could not load requests.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: 'in-progress' | 'resolve') {
    setBusy(id); setNotice('');
    try { await apiFetch(auth, '/api/admin/service-requests', { id, action, message: replies[id] || '' }); if (action === 'resolve') setNotice('Resolved. The customer was emailed your message and a satisfaction survey.'); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(null); }
  }

  const shown = (rows || []).filter(r => filter === 'all' || (filter === 'open' ? r.status !== 'resolved' : r.status === 'resolved'))
    .sort((a, b) => filter === 'open' ? (Number(b.overdue) - Number(a.overdue)) || (a.createdAt || '').localeCompare(b.createdAt || '') : (b.createdAt || '').localeCompare(a.createdAt || ''));

  return <div className="space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Service desk</h1>
      <p className="text-muted-foreground">Reschedule and cancellation requests and damage claims from customers. Targets: first response within {RESPONSE_TARGET_HOURS.reschedule} hours for date changes and cancellations, {RESPONSE_TARGET_HOURS.claim} hours for claims. Make any booking or refund change first, then resolve with a message to the customer.</p>
    </div>
    {metrics && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[['Open', metrics.open], ['Past response target', metrics.overdue], ['Open claims', metrics.claimsOpen], ['Customer satisfaction', metrics.satisfactionPercent === null ? '—' : `${metrics.satisfactionPercent}% (${metrics.satisfactionCount})`]].map(([label, value]) =>
        <Card key={String(label)} className={`bg-white ${label === 'Past response target' && Number(value) > 0 ? 'border-red-300' : ''}`}><CardContent className="p-4"><p className="text-2xl font-black text-primary">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}
    </div>}
    <div className="flex gap-2" role="tablist" aria-label="Request status">{(['open', 'resolved', 'all'] as const).map(f => <Button key={f} role="tab" aria-selected={filter === f} variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f}</Button>)}<Button variant="ghost" onClick={() => void load()}>Refresh</Button></div>
    {notice && <p role="status" className="font-medium">{notice}</p>}
    {rows === null ? <p>Loading…</p> : shown.length === 0 ? <p className="text-muted-foreground">{filter === 'open' ? 'Nothing open. Customers send requests from their move page.' : 'Nothing here.'}</p> :
      <div className="space-y-3">{shown.map(r => {
        const wait = r.status === 'open' ? waitStatus(r.createdAt ? Date.parse(r.createdAt) : null, RESPONSE_TARGET_HOURS[r.type]) : null;
        return <Card key={r.id} className={`bg-white ${r.overdue ? 'border-red-300' : ''}`}><CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{SERVICE_REQUEST_LABELS[r.type]}</strong>
            <Badge className={`border-none ${r.status === 'resolved' ? 'bg-green-100 text-green-800' : r.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{r.status}</Badge>
            {wait && <span className={`text-xs font-bold ${wait.overdue ? 'text-red-700' : 'text-muted-foreground'}`}>waiting {wait.label}</span>}
            {r.satisfaction !== null && <span className="text-xs font-bold">Rated {r.satisfaction}/5</span>}
          </div>
          <p className="text-sm">{r.customerName} · {r.customerPhone && <a className="underline" href={`tel:${r.customerPhone}`}>{r.customerPhone}</a>} · <a className="underline" href={`mailto:${r.customerEmail}`}>{r.customerEmail}</a> · move {r.moveDate || '—'} · <Link className="underline" href={`/dashboard/admin/jobs/${r.jobId}`}>Open job</Link></p>
          {r.requestedDate && <p className="text-sm"><strong>Requested new date:</strong> {r.requestedDate}</p>}
          {r.item && <p className="text-sm"><strong>Item:</strong> {r.item}{r.estimatedValue !== null ? ` · est. $${r.estimatedValue.toLocaleString()}` : ''}</p>}
          <p className="whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-3">{r.reason}</p>
          <Photos paths={r.photoPaths} />
          {r.status === 'resolved' ? r.adminMessage && <p className="text-sm"><strong>Our reply:</strong> {r.adminMessage}</p> : <>
            <Textarea aria-label="Message to the customer" placeholder="Message to the customer: what you did and any next steps" value={replies[r.id] || ''} onChange={e => setReplies({ ...replies, [r.id]: e.target.value })} maxLength={3000} />
            <div className="flex flex-wrap gap-2">
              {r.status === 'open' && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r.id, 'in-progress')}>Mark in progress</Button>}
              <Button size="sm" disabled={busy === r.id || (replies[r.id] || '').trim().length < 5} onClick={() => void act(r.id, 'resolve')}>Resolve and email customer</Button>
            </div>
          </>}
        </CardContent></Card>;
      })}</div>}
  </div>;
}

export default function AdminServicePage() { return <EmployeeLayout isAdmin><ServiceDesk /></EmployeeLayout>; }
