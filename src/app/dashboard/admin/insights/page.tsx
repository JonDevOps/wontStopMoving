'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Totals = { gmv: number; platformRevenue: number; payoutsPaid: number; payoutsPending: number; bookings: number; completed: number; cancelled: number; averageOrder: number; quotes: number; quoteToBookingPercent: number | null; marketingSpend: number; costPerBooking: number | null };
type Channel = { name: string; leads: number; bookings: number; revenue: number; spend: number; costPerBooking: number | null; returnOnSpend: number | null };
type Data = { days: number; totals: Totals; channels: Channel[]; daily: { day: string; amount: number }[]; spendMonths: { month: string; channels: Record<string, number> }[]; channelNames: string[] };
const money = (n: number | null | undefined) => n === null || n === undefined ? '—' : `$${Math.round(n).toLocaleString()}`;

function SpendForm({ channelNames, existing, onSaved }: { channelNames: string[]; existing: Data['spendMonths']; onSaved: () => void }) {
  const auth = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => { const m = existing.find(e => e.month === month); setValues(Object.fromEntries(Object.entries(m?.channels || {}).map(([k, v]) => [k, String(v)]))); }, [month, existing]);
  async function save() {
    setMsg('');
    try { await apiFetch(auth, '/api/admin/insights', { month, channels: values }); setMsg('Saved.'); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save.'); }
  }
  const paid = channelNames.filter(c => c !== 'Direct' && c !== 'Organic search');
  return <Card className="bg-white"><CardContent className="p-5 space-y-3">
    <h2 className="font-bold">Marketing spend</h2>
    <p className="text-sm text-muted-foreground">Enter what you spent each month per channel (ads, sponsorships, referral rewards…) to see cost per booking.</p>
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label htmlFor="spend-month">Month</Label><Input id="spend-month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44" /></div>
      {paid.map(c => <div key={c} className="space-y-1"><Label htmlFor={`spend-${c}`}>{c}</Label><Input id={`spend-${c}`} type="number" min="0" step="1" className="w-32" value={values[c] || ''} onChange={e => setValues({ ...values, [c]: e.target.value })} /></div>)}
      <Button onClick={() => void save()}>Save</Button>
    </div>
    {msg && <p role="status" className="text-sm">{msg}</p>}
  </CardContent></Card>;
}

function Insights() {
  const auth = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await apiFetch<Data>(auth, `/api/admin/insights?days=${days}`)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load insights.'); }
  }, [auth, days]);
  useEffect(() => { void load(); }, [load]);

  const t = data?.totals;
  const max = Math.max(1, ...(data?.daily || []).map(d => d.amount));
  const tiles: [string, string, string?][] = t ? [
    ['Bookings value', money(t.gmv), `${t.bookings} paid bookings`],
    ['Your revenue (15%)', money(t.platformRevenue)],
    ['Average booking', money(t.averageOrder)],
    ['Quote → booking', t.quoteToBookingPercent === null ? '—' : `${t.quoteToBookingPercent}%`, `${t.quotes} quotes`],
    ['Paid to providers', money(t.payoutsPaid), t.payoutsPending ? `${money(t.payoutsPending)} awaiting manual payout` : undefined],
    ['Completed · cancelled', `${t.completed} · ${t.cancelled}`],
    ['Marketing spend', money(t.marketingSpend)],
    ['Cost per booking', money(t.costPerBooking)],
  ] : [];

  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Insights</h1><p className="text-muted-foreground">The business at a glance: bookings, revenue, payouts and what your marketing returns.</p></div>
      <div className="flex gap-2" role="tablist" aria-label="Period">{[30, 90, 365].map(d => <Button key={d} role="tab" aria-selected={days === d} variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>{d === 365 ? '12 months' : `${d} days`}</Button>)}</div>
    </div>
    {error && <p role="status">{error}</p>}
    {!data ? !error && <p>Loading…</p> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{tiles.map(([label, value, sub]) => <Card key={label} className="bg-white"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-black text-primary">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</CardContent></Card>)}</div>

      <Card className="bg-white"><CardContent className="p-5 space-y-2">
        <h2 className="font-bold">Bookings value by day</h2>
        {data.daily.length === 0 ? <p className="text-sm text-muted-foreground">No paid bookings in this period yet.</p> :
          <div className="flex items-end gap-1 h-40" role="img" aria-label={`Daily bookings value over ${data.days} days`}>
            {data.daily.map(d => <div key={d.day} title={`${d.day}: ${money(d.amount)}`} className="flex-1 min-w-[3px] bg-accent rounded-t" style={{ height: `${Math.max(4, (d.amount / max) * 100)}%` }} />)}
          </div>}
      </CardContent></Card>

      <Card className="bg-white"><CardContent className="p-5 overflow-x-auto">
        <h2 className="font-bold mb-2">By marketing channel</h2>
        {data.channels.length === 0 ? <p className="text-sm text-muted-foreground">No leads or bookings in this period yet.</p> :
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b">{['Channel', 'Leads', 'Bookings', 'Your revenue', 'Spend', 'Cost per booking', 'Return on spend'].map(h => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{data.channels.map(c => <tr key={c.name} className="border-b last:border-0"><td className="py-2 pr-3 font-medium">{c.name}</td><td className="pr-3">{c.leads}</td><td className="pr-3">{c.bookings}</td><td className="pr-3">{money(c.revenue)}</td><td className="pr-3">{c.spend ? money(c.spend) : '—'}</td><td className="pr-3">{money(c.costPerBooking)}</td><td>{c.returnOnSpend === null ? '—' : `${c.returnOnSpend.toFixed(1)}×`}</td></tr>)}</tbody></table>}
        <p className="text-xs text-muted-foreground mt-2">Revenue here is your 15% platform fee. Return on spend above 1× means the channel earns more than it costs.</p>
      </CardContent></Card>

      <SpendForm channelNames={data.channelNames} existing={data.spendMonths} onSaved={() => void load()} />
    </>}
  </div>;
}

export default function AdminInsightsPage() { return <EmployeeLayout isAdmin><Insights /></EmployeeLayout>; }
