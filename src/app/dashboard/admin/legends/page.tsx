'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { BRANDS, GROUP_LABEL, LEGEND_SIZES, REVENUE_PER_TRUCK, type LegendGroup } from '@/lib/legends';
import { SOCIAL_LABEL } from '@/lib/competitors';

type Row = {
  rank: number; group: LegendGroup; dot: string; state: string; name: string; dba: string; city: string; units: number; drivers: number; miles: number; years: number; size: number;
  revenue: { low: number; high: number }; brand: { key: string; label: string; kind: string } | null; site: string | null; socials: Record<string, string>; followers: number | null;
  milesFromUs: number | null; kind: string | null; strategy: string | null; google: 'matched' | 'none' | null; competitorId: string | null;
};
type Usage = { month: string; details: number; match: number; detailsCap: number; matchCap: number };
type Data = { groups: Record<LegendGroup, Row[]>; brandCounts: Record<string, number>; statesLoaded: number; complete: boolean; jev: boolean; places: { ready: boolean; usage: Usage | null } };
type GoogleInfo = { name: string; address: string; rating: number | null; reviews: number | null; website: string | null; phone: string | null; status: string | null; mapsUrl: string | null };

const GROUPS = Object.keys(GROUP_LABEL) as LegendGroup[];
const STRATEGY: Record<string, { label: string; style: string; hint: string }> = {
  partner: { label: 'Partner', style: 'bg-green-100 text-green-800', hint: 'Agent or partner candidate for our network' },
  study: { label: 'Study', style: 'bg-blue-100 text-blue-800', hint: 'A legend to learn from' },
  compete: { label: 'Compete', style: 'bg-red-100 text-red-800', hint: 'Direct rival in the Bay Area' },
  acquire: { label: 'Acquire?', style: 'bg-purple-100 text-purple-800', hint: 'Possible buy-out target' },
  ignore: { label: 'Ignore', style: 'bg-slate-100 text-slate-600', hint: 'Not relevant' },
};
const KIND: Record<string, string> = { local_mover: 'Local mover', van_line: 'Van line', broker: 'Broker', freight: 'Freight', other: 'Not a mover' };
const nice = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());
const money = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`;
const PAGE = 50;

function Legends() {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [group, setGroup] = useState<LegendGroup>('national');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('');
  const [google, setGoogle] = useState<Record<string, GoogleInfo | null | 'loading'>>({});

  const load = useCallback((refresh = false) => apiFetch<Data>(auth, `/api/admin/legends${refresh ? '?refresh=1' : ''}`).then(setData).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load legends', description: e instanceof Error ? e.message : '' })), [auth, toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setPage(1), [group, filter]);

  const rows = useMemo(() => (data?.groups[group] || []).filter(r => !filter || (filter === 'tracked' ? r.competitorId : filter.startsWith('brand:') ? r.brand?.key === filter.slice(6) : r.strategy === filter)), [data, group, filter]);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(rows.length / PAGE);
  const usage = data?.places.usage;

  const run = async (action: 'match-google' | 'jev') => {
    setBusy(action);
    try {
      const r = await apiFetch<any>(auth, '/api/admin/legends', { action, group });
      toast({ title: action === 'jev' ? `Jev reviewed ${r.done} of ${r.checked}` : `Matched ${r.matched} of ${r.checked} to Google`, description: [r.stopped, r.failed ? `${r.failed} didn’t finish.` : '', r.remaining ? `${r.remaining} left in this list: click again.` : 'This list is done.'].filter(Boolean).join(' ') });
      await load(true);
    } catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const showGoogle = async (r: Row) => {
    setGoogle(g => ({ ...g, [r.dot]: 'loading' }));
    try { const res = await apiFetch<{ info: GoogleInfo | null; usage: Usage }>(auth, `/api/admin/registry/${r.dot}?state=${r.state}`, { action: 'google' }); setGoogle(g => ({ ...g, [r.dot]: res.info })); setData(d => d ? { ...d, places: { ...d.places, usage: res.usage } } : d); }
    catch (e) { setGoogle(g => { const n = { ...g }; delete n[r.dot]; return n; }); toast({ variant: 'destructive', title: 'Google lookup didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  const track = async (r: Row) => {
    try { await apiFetch(auth, `/api/admin/registry/${r.dot}?state=${r.state}`, { action: 'track', tier: 'legend' }); toast({ title: `${nice(r.dba || r.name)} added to Competitors → Legends` }); await load(true); }
    catch (e) { toast({ variant: 'destructive', title: 'Couldn’t track', description: e instanceof Error ? e.message : '' }); }
  };

  const groupRows = data?.groups[group] || [];
  const brandsHere = Object.entries(groupRows.reduce((acc, r) => { if (r.brand) acc[r.brand.key] = (acc[r.brand.key] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]);
  const unmatched = groupRows.filter(r => r.google === null).length, unreviewed = groupRows.filter(r => !r.strategy).length;

  return <div className="space-y-6">
    <div className="space-y-2">
      <h1 className="text-3xl font-black text-primary">Legends</h1>
      <p className="text-muted-foreground">The biggest moving companies: the top {LEGEND_SIZES.national} in the lower 48, the next {LEGEND_SIZES.perZone} in each time zone, and the top {LEGEND_SIZES.alaska} in Alaska and Hawaii.</p>
      <details className="text-sm bg-white border rounded-lg p-3"><summary className="cursor-pointer font-semibold">How this list is built</summary>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Ranked by size score from the federal registry: trucks × 10 + drivers × 4 + miles ÷ 25,000. Companies Jev sorted as brokers, freight carriers or non-movers are left out.</li>
          <li>Time zones are by state; states split between zones go with the zone most of their people live in.</li>
          <li>Revenue is a rough range from fleet size (about {money(REVENUE_PER_TRUCK.low)}–{money(REVENUE_PER_TRUCK.high)} a year per truck), not reported revenue.</li>
          <li>Brand and franchise networks are recognized from the company’s name or website.</li>
          <li>Google ratings are shown live when you click, never saved (Google’s terms). Only each company’s Google place ID is kept.</li>
          <li>Jev’s call (Partner, Study, Compete, Acquire?, Ignore) uses our own data: federal record, website, social profiles and stats, size, brand and distance from Mountain View.</li>
        </ul>
      </details>
      {data && !data.complete && <p className="text-sm text-amber-700">Some states haven’t finished loading in the registry; their companies will appear after the next refresh.</p>}
    </div>

    <div className="flex flex-wrap gap-2">{GROUPS.map(g => <Button key={g} size="sm" variant={g === group ? 'default' : 'outline'} onClick={() => setGroup(g)}>{GROUP_LABEL[g]}{data ? ` (${data.groups[g].length})` : ''}</Button>)}</div>

    <Card className="bg-white"><CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="font-semibold">Show:</span>
        <select aria-label="Filter" className="border rounded-md px-2 py-1" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Everyone</option><option value="tracked">Tracked</option>
          {Object.entries(STRATEGY).map(([k, v]) => <option key={k} value={k}>Jev: {v.label}</option>)}
          {brandsHere.map(([k, n]) => <option key={k} value={`brand:${k}`}>{BRANDS.find(b => b.key === k)?.label} ({n})</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {data?.jev && <Button size="sm" variant="outline" disabled={!!busy || !unreviewed} onClick={() => run('jev')}>{busy === 'jev' ? 'Jev is reviewing…' : unreviewed ? `Ask Jev about ${Math.min(40, unreviewed)} more` : 'Jev reviewed this list'}</Button>}
        {data?.places.ready && <Button size="sm" variant="outline" disabled={!!busy || !unmatched} onClick={() => run('match-google')} title="Finds each company’s Google listing and keeps only its place ID">{busy === 'match-google' ? 'Matching…' : unmatched ? `Match ${Math.min(40, unmatched)} to Google` : 'All matched to Google'}</Button>}
      </div>
    </CardContent></Card>

    {brandsHere.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{brandsHere.map(([k, n]) => { const b = BRANDS.find(x => x.key === k)!; return <span key={k} className="px-2 py-1 rounded-full border bg-white">{b.label} ({b.kind}): <b>{n}</b> here · {data?.brandCounts[k] || n} nationwide</span>; })}</div>}

    <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground border-b">{['#', 'Company', 'Trucks', 'Drivers', 'Years', 'Est. revenue', 'Jev', 'Online', 'Google', ''].map(h => <th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>{shown.map(r => { const g = google[r.dot]; return <tr key={r.dot} className="border-b last:border-0 align-top">
        <td className="p-3 text-muted-foreground">{r.rank}</td>
        <td className="p-3"><Link className="font-bold text-primary hover:underline" href={`/dashboard/admin/movers?dot=${r.dot}&state=${r.state}`}>{nice(r.dba || r.name)}</Link>
          <p className="text-xs text-muted-foreground">{nice(r.city)}, {r.state}{r.milesFromUs !== null ? ` · ${r.milesFromUs.toLocaleString()} mi away` : ''}</p>
          {r.brand && <Badge variant="outline" className="text-[10px] mt-1">{r.brand.label}</Badge>}</td>
        <td className="p-3 font-semibold">{r.units}</td><td className="p-3">{r.drivers}</td><td className="p-3">{r.years || '—'}</td>
        <td className="p-3 whitespace-nowrap">{money(r.revenue.low)}–{money(r.revenue.high)}</td>
        <td className="p-3">{r.strategy ? <span title={STRATEGY[r.strategy]?.hint} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STRATEGY[r.strategy]?.style}`}>{STRATEGY[r.strategy]?.label}</span> : <span className="text-xs text-muted-foreground">—</span>}{r.kind && <p className="text-[11px] text-muted-foreground mt-1">{KIND[r.kind]}</p>}</td>
        <td className="p-3 text-xs">{r.site ? <a className="underline break-all" href={r.site} target="_blank" rel="noreferrer noopener">{r.site.replace(/^https?:\/\/(www\.)?/, '')}</a> : <span className="text-muted-foreground">No site yet</span>}
          {Object.keys(r.socials).length > 0 && <p className="mt-1">{Object.entries(r.socials).map(([k, u]) => <a key={k} className="underline mr-1" href={u} target="_blank" rel="noreferrer noopener">{SOCIAL_LABEL[k] || k}</a>)}</p>}
          {r.followers ? <p className="mt-1">{r.followers.toLocaleString()} followers</p> : null}</td>
        <td className="p-3 text-xs min-w-[150px]">
          {g === 'loading' ? 'Asking Google…' : g === null ? <span className="text-muted-foreground">No listing found</span> : g ? <div className="border rounded-md p-2 space-y-0.5 bg-slate-50">
            <p>{g.rating !== null ? <b>{g.rating.toFixed(1)} ★</b> : 'No rating'} · {(g.reviews || 0).toLocaleString()} reviews</p>
            {g.status && g.status !== 'OPERATIONAL' && <p className="text-red-700">{g.status === 'CLOSED_PERMANENTLY' ? 'Permanently closed' : 'Temporarily closed'}</p>}
            {g.mapsUrl && <a className="underline" href={g.mapsUrl} target="_blank" rel="noreferrer noopener">Google Maps</a>}
            <p className="text-[10px] text-muted-foreground">Data: Google Maps (live, not saved)</p>
          </div> : data?.places.ready ? <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={!!usage && usage.details >= usage.detailsCap} onClick={() => showGoogle(r)}>{r.google === 'none' ? 'Try Google' : 'Show Google'}</Button> : <span className="text-muted-foreground">Not set up</span>}
        </td>
        <td className="p-3">{r.competitorId ? <Badge className="text-[10px]">Tracked</Badge> : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => track(r)}>Track</Button>}</td>
      </tr>; })}
        {data && !rows.length && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No companies here yet.</td></tr>}
        {!data && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}</tbody>
    </table></CardContent></Card>
    {pages > 1 && <div className="flex items-center gap-3 justify-center"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
    {usage && <p className="text-xs text-muted-foreground text-center">Google this month: {usage.details}/{usage.detailsCap} live lookups · {usage.match}/{usage.matchCap} matches. Both stay under Google’s free monthly allowance and reset on the 1st.</p>}
  </div>;
}

export default function LegendsPage() { return <EmployeeLayout isAdmin><Legends /></EmployeeLayout>; }
