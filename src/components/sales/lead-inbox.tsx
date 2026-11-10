'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { Inbox, Timer, PhoneCall, TrendingUp, DollarSign, Zap } from 'lucide-react';

type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost';
type Lead = {
  id: string; status: LeadStatus; name: string; phone: string; email: string; moveSize: string; pickup: string; dropoff: string;
  moveDate: string; estimatedTotal: number; assignedTo: string | null; assignedName: string | null; lostReason: string | null;
  createdAt: number | null; firstContactAt: number | null; lastContactAt: number | null; responseMinutes: number | null;
};
type Metrics = { today: number; waiting: number; medianResponseMinutes: number | null; within5Percent: number | null; bookedPercent: number | null; bookedRevenue: number; pipelineValue: number };
type Filter = 'new' | 'mine' | 'contacted' | 'booked' | 'lost' | 'all';

const STATUS_STYLE: Record<LeadStatus, string> = { new: 'bg-red-100 text-red-800', contacted: 'bg-blue-100 text-blue-800', booked: 'bg-green-100 text-green-800', lost: 'bg-gray-100 text-gray-700' };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const minutes = (m: number | null) => m === null ? '—' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;

function waitingFor(createdAt: number | null, now: number) {
  if (!createdAt) return { text: '', urgent: false };
  const m = Math.max(0, Math.floor((now - createdAt) / 60000));
  return { text: `waiting ${minutes(m)}`, urgent: m >= 5 };
}

export function LeadInbox({ playbookPath }: { playbookPath: string }) {
  const auth = useAuth();
  const { user } = useUser();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lostReasons, setLostReasons] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('new');
  const [busy, setBusy] = useState<string | null>(null);
  const [losing, setLosing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ leads: Lead[]; metrics: Metrics; lostReasons: string[] }>(auth, '/api/admin/leads');
      setLeads(r.leads); setMetrics(r.metrics); setLostReasons(r.lostReasons);
    } catch (e) { setLeads([]); setNotice(e instanceof Error ? e.message : 'Could not load leads.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  // Live waiting clocks, and pick up new leads every minute.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); const r = setInterval(() => void load(), 60000); return () => { clearInterval(t); clearInterval(r); }; }, [load]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(id); setNotice('');
    try { await apiFetch(auth, '/api/admin/leads', { action, id, ...extra }); setLosing(null); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(null); }
  }

  const playbookHref = (l: Lead) => `${playbookPath}?${new URLSearchParams({ lead: l.id, callType: l.status === 'new' ? 'web-lead' : 'quote-followup', name: l.name, phone: l.phone, email: l.email, date: l.moveDate }).toString()}`;

  const counts: Record<Filter, number> = { new: 0, mine: 0, contacted: 0, booked: 0, lost: 0, all: leads?.length || 0 };
  (leads || []).forEach(l => { counts[l.status]++; if (l.assignedTo === user?.uid && (l.status === 'new' || l.status === 'contacted')) counts.mine++; });
  const shown = (leads || []).filter(l => filter === 'all' ? true : filter === 'mine' ? l.assignedTo === user?.uid && (l.status === 'new' || l.status === 'contacted') : l.status === filter)
    .sort((a, b) => filter === 'new' ? (a.createdAt || 0) - (b.createdAt || 0) : (b.createdAt || 0) - (a.createdAt || 0));

  const stats = metrics ? [
    { label: 'New today', value: String(metrics.today), icon: Inbox },
    { label: 'Waiting for a call', value: String(metrics.waiting), icon: Zap, alert: metrics.waiting > 0 },
    { label: 'Median response (7 days)', value: minutes(metrics.medianResponseMinutes), icon: Timer },
    { label: 'Called within 5 min (7 days)', value: metrics.within5Percent === null ? '—' : `${metrics.within5Percent}%`, icon: PhoneCall },
    { label: 'Booked (60 days)', value: metrics.bookedPercent === null ? '—' : `${metrics.bookedPercent}% · ${money(metrics.bookedRevenue)}`, icon: TrendingUp },
    { label: 'Open pipeline', value: money(metrics.pipelineValue), icon: DollarSign },
  ] : [];

  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Lead inbox</h1>
      <p className="text-muted-foreground">Every quote request from the website. Call new leads within 5 minutes: the oldest waiting lead is at the top. Logging a call from the playbook marks the lead contacted.</p>
    </div>

    {metrics && <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map(s => <Card key={s.label} className={`bg-white ${s.alert ? 'border-red-300' : ''}`}><CardContent className="p-4 flex items-center gap-3">
        <s.icon className={`h-5 w-5 shrink-0 ${s.alert ? 'text-red-600' : 'text-accent'}`} />
        <div><p className="text-xl font-black text-primary">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
      </CardContent></Card>)}
    </div>}

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lead status">
      {([['new', 'New'], ['mine', 'My open leads'], ['contacted', 'Contacted'], ['booked', 'Booked'], ['lost', 'Lost'], ['all', 'All']] as [Filter, string][]).map(([v, label]) =>
        <Button key={v} role="tab" aria-selected={filter === v} variant={filter === v ? 'default' : 'outline'} onClick={() => setFilter(v)}>{label} ({counts[v]})</Button>)}
      <Button variant="ghost" onClick={() => void load()}>Refresh</Button>
    </div>
    {notice && <p role="status" className="font-medium">{notice}</p>}

    {leads === null ? <p>Loading leads…</p> : shown.length === 0 ? <p className="text-muted-foreground">{filter === 'new' ? 'No leads waiting. Nice work.' : 'No leads here.'}</p> :
      <div className="space-y-3">{shown.map(l => {
        const wait = l.status === 'new' ? waitingFor(l.createdAt, now) : null;
        return <Card key={l.id} className={`bg-white ${wait?.urgent ? 'border-red-300' : ''}`}><CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-primary">{l.name || 'Unnamed lead'}</p>
                <Badge className={`${STATUS_STYLE[l.status]} border-none capitalize`}>{l.status}</Badge>
                {wait && <span className={`text-xs font-bold ${wait.urgent ? 'text-red-700' : 'text-amber-700'}`}>{wait.text}</span>}
              </div>
              <p className="text-sm">{l.moveSize} · {l.pickup || '?'} → {l.dropoff || '?'} · {l.moveDate || 'no date'} · <strong>{money(l.estimatedTotal)}</strong></p>
              <p className="text-xs text-muted-foreground">
                {l.createdAt ? `Requested ${new Date(l.createdAt).toLocaleString()}` : ''}
                {l.responseMinutes !== null ? ` · first contact after ${minutes(l.responseMinutes)}` : ''}
                {l.assignedName ? ` · ${l.assignedName}` : ' · unassigned'}
                {l.lostReason ? ` · lost: ${l.lostReason}` : ''}
              </p>
              <p className="text-xs">{l.phone && <a className="underline mr-3" href={`tel:${l.phone}`}>{l.phone}</a>}{l.email && <a className="underline" href={`mailto:${l.email}`}>{l.email}</a>}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(l.status === 'new' || l.status === 'contacted') && <>
                <Button asChild size="sm"><Link href={playbookHref(l)}>Start call</Link></Button>
                {!l.assignedTo && <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => void act(l.id, 'claim')}>Claim</Button>}
                {l.status === 'new' && <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => void act(l.id, 'contacted')}>Mark contacted</Button>}
                <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => setLosing(losing === l.id ? null : l.id)}>Mark lost</Button>
              </>}
              {l.status === 'lost' && <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => void act(l.id, 'reopen')}>Reopen</Button>}
            </div>
          </div>
          {losing === l.id && <div className="flex flex-wrap gap-2 border-t pt-3" role="group" aria-label="Why was this lead lost?">
            <span className="text-xs font-bold self-center">Why?</span>
            {lostReasons.map(r => <Button key={r} size="sm" variant="outline" disabled={busy === l.id} onClick={() => void act(l.id, 'lost', { reason: r })}>{r}</Button>)}
          </div>}
        </CardContent></Card>;
      })}</div>}
  </div>;
}
