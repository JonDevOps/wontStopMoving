'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { REGION_PRESETS, REGISTRY_AREAS } from '@/lib/registry';
import type { Bounds, MapPoint, StateStat } from '@/components/registry/mover-map';

const MoverMap = dynamic(() => import('@/components/registry/mover-map').then(m => m.MoverMap), { ssr: false, loading: () => <div className="h-[420px] md:h-[520px] rounded-2xl bg-slate-100 animate-pulse" /> });

type Row = {
  dot: string; mc: string; name: string; dba: string; street: string; city: string; state: string; zip: string; phone: string; email: string; site: string; officer: string; org: string;
  units: number; drivers: number; miles: number; years: number; interstate: boolean; hhgAuth: boolean; broker: boolean; moverScore: number;
  kind: string | null; sosActive: boolean | null; competitorId: string | null;
};
type Rank = { rank: number; of: number; nextUp: { dot: string; name: string; city: string; state: string; units: number; drivers: number; years: number; gap: { units: number; drivers: number; years: number } }[] };
type Result = { mode: 'national' | 'detailed'; nationalComplete?: boolean | null; total: number; rows: Row[]; rank: Rank | null; points?: MapPoint[]; totals: { units: number; drivers: number }; updatedAt: string | null; synced: number; jev: boolean; stateStats?: (StateStat & { count: number; updatedAt: string | null })[] };

const KIND_LABEL: Record<string, string> = { local_mover: 'Local mover', van_line: 'Van line', broker: 'Broker', freight: 'Freight', other: 'Not a mover' };
const KIND_STYLE: Record<string, string> = { local_mover: 'bg-green-100 text-green-800', van_line: 'bg-blue-100 text-blue-800', broker: 'bg-amber-100 text-amber-800', freight: 'bg-slate-200 text-slate-700', other: 'bg-red-100 text-red-800' };
const FOCUS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'bay-area': { lat: 37.65, lng: -122.1, zoom: 9 }, 'puget-sound': { lat: 47.5, lng: -122.3, zoom: 9 }, socal: { lat: 34.0, lng: -118.1, zoom: 9 }, national: { lat: 39.5, lng: -98.5, zoom: 4 },
};
const SORTS = { size: 'Biggest overall', units: 'Most trucks', drivers: 'Most drivers', miles: 'Most miles', years: 'Longest in business', newest: 'Newest registered first', name: 'Name A–Z' } as const;
const phone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const nice = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());

function Registry() {
  const auth = useAuth();
  const { toast } = useToast();
  const [area, setArea] = useState<string>('bay-area'); // region preset, a state code, 'national' or 'map'
  const [f, setF] = useState({ q: '', city: '', minUnits: '', minDrivers: '', minYears: '', newDays: '', interstate: '', hhg: false, likely: true, site: '', kind: '', sos: '', tracked: '', sort: 'size', rankBy: 'size' });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(FOCUS['bay-area']);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ dot: string; state: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [stateTotals, setStateTotals] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const params = useMemo(() => {
    const p = new URLSearchParams({ sort: f.sort, rankBy: f.rankBy, page: String(page), pageSize: '50', map: '1', stats: '1' });
    if (area === 'map' && bounds) for (const k of ['south', 'west', 'north', 'east'] as const) p.set(k, bounds[k].toFixed(4));
    // Map pins always cover the visible map, whatever area the list uses.
    if (bounds) { p.set('vbSouth', bounds.south.toFixed(3)); p.set('vbWest', bounds.west.toFixed(3)); p.set('vbNorth', bounds.north.toFixed(3)); p.set('vbEast', bounds.east.toFixed(3)); }
    else if (REGION_PRESETS[area]) p.set('region', area);
    else if (REGISTRY_AREAS.includes(area)) p.set('states', area);
    for (const [k, v] of Object.entries({ q: f.q, city: f.city, minUnits: f.minUnits, minDrivers: f.minDrivers, minYears: f.minYears, newDays: f.newDays, interstate: f.interstate, kind: f.kind, sos: f.sos, tracked: f.tracked, site: f.site })) if (v) p.set(k, v);
    if (f.hhg) p.set('hhg', '1');
    if (!f.likely) p.set('likely', '0');
    return p;
  }, [area, bounds, f, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch<Result>(auth, `/api/admin/registry?${params}`)); }
    catch (e) { toast({ variant: 'destructive', title: 'Couldn’t load movers', description: e instanceof Error ? e.message : '' }); }
    finally { setLoading(false); }
  }, [auth, params, toast]);
  useEffect(() => { clearTimeout(timer.current); timer.current = setTimeout(() => void load(), 350); return () => clearTimeout(timer.current); }, [load]);

  const chooseArea = (a: string) => {
    setArea(a); setPage(1);
    if (FOCUS[a]) setFocus(FOCUS[a]);
    else { const c = data?.stateStats?.find(s => s.state === a)?.center; if (c) setFocus({ lat: c[0], lng: c[1], zoom: 6 }); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }); setPage(1); };

  const post = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    try { return await apiFetch<any>(auth, '/api/admin/registry', body); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); return null; }
    finally { setBusy(''); }
  };
  const queryObject = () => Object.fromEntries([...params.entries()].filter(([k]) => !['page', 'pageSize', 'map', 'stats'].includes(k)));
  const exportCsv = async () => {
    setBusy('csv');
    try {
      const user = auth.currentUser; if (!user) return;
      const p = new URLSearchParams(params); p.set('format', 'csv'); p.delete('map'); p.delete('stats');
      const res = await fetch(`/api/admin/registry?${p}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!res.ok) throw new Error('Export failed.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `movers-${area}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast({ variant: 'destructive', title: 'Export failed', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };

  const areaLabel = REGION_PRESETS[area]?.label || (area === 'national' ? 'Whole country' : area === 'map' ? 'Map view' : area);
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const notSynced = data && data.synced === 0;

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Mover registry</h1>
      <p className="text-muted-foreground">Every active U.S. moving company registered with the Department of Transportation (free FMCSA data, refreshed daily). Search any area, see where you rank, and add companies to your competitor lists.</p>
    </div>

    {notSynced && <Card className="bg-amber-50 border-amber-200"><CardContent className="p-4 text-sm space-y-2">
      <p className="font-bold">The registry is loading for the first time.</p>
      <p>The daily import fills all 50 states within a few hours of going live, starting with California and Washington. You can load a state now:</p>
      <div className="flex gap-2 flex-wrap">{['CA', 'WA'].map(s => <Button key={s} size="sm" disabled={!!busy} onClick={async () => { const r = await post({ action: 'sync', state: s }, `sync-${s}`); if (r) { toast({ title: `${s} loaded`, description: `${r.likely.toLocaleString()} likely movers of ${r.count.toLocaleString()} registered.` }); void load(); } }}>{busy === `sync-${s}` ? `Loading ${s}…` : `Load ${s} now`}</Button>)}</div>
    </CardContent></Card>}

    <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" variant={area === 'national' ? 'default' : 'outline'} onClick={() => chooseArea('national')}>Whole country</Button>
      {Object.entries(REGION_PRESETS).map(([k, r]) => <Button key={k} size="sm" variant={area === k ? 'default' : 'outline'} onClick={() => chooseArea(k)}>{r.label}</Button>)}
      <Button size="sm" variant={area === 'map' ? 'default' : 'outline'} onClick={() => { setArea('map'); setPage(1); }}>Whatever the map shows</Button>
      <select aria-label="State" className="h-9 border rounded-md px-2 bg-white text-sm" value={REGISTRY_AREAS.includes(area) ? area : ''} onChange={e => e.target.value && chooseArea(e.target.value)}>
        <option value="">A state…</option>{REGISTRY_AREAS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>

    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-2">
        <MoverMap points={data?.points || []} stateStats={(data?.stateStats || []) as StateStat[]} focus={focus}
          onBounds={b => { setBounds(b); if (area === 'map') setPage(1); }} onSelect={(dot, state) => setSelected({ dot, state })} onState={s => { setStateTotals(false); chooseArea(s); }} highlight={selected?.dot} stateTotals={stateTotals} />
        <div className="flex flex-wrap justify-between gap-2 items-center"><p className="text-xs text-muted-foreground">Red: 20+ trucks · Orange: 5–19 · Gray: under 5. The map shows every company in view, anywhere you pan (with your filters); numbers are clusters, zoom in to split them. Pins sit at each company’s ZIP code. {area !== 'map' && `The list below is ${areaLabel}; choose “Whatever the map shows” to list what’s on screen.`}</p><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={stateTotals} onChange={e => setStateTotals(e.target.checked)} />Show state totals instead</label></div>
      </div>
      <RankCard data={data} areaLabel={areaLabel} rankBy={f.rankBy} setRankBy={v => setF({ ...f, rankBy: v })} onOpen={(dot, state) => setSelected({ dot, state })} />
    </div>

    <Card className="bg-white"><CardContent className="p-4 space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <Input placeholder="Name, DOT, MC or owner" value={f.q} onChange={set('q')} className="lg:col-span-2" />
        <Input placeholder="City" value={f.city} onChange={set('city')} />
        <Input placeholder="Min trucks" inputMode="numeric" value={f.minUnits} onChange={set('minUnits')} />
        <Input placeholder="Min drivers" inputMode="numeric" value={f.minDrivers} onChange={set('minDrivers')} />
        <Input placeholder="Min years in business" inputMode="numeric" value={f.minYears} onChange={set('minYears')} />
        <select aria-label="Sort" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.sort} onChange={set('sort')}>{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}</select>
        <select aria-label="Interstate" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.interstate} onChange={set('interstate')}><option value="">Local & interstate</option><option value="yes">Interstate only</option><option value="no">In-state only</option></select>
        <select aria-label="Company type" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.kind} onChange={set('kind')}><option value="">Any type (Jev)</option><option value="local_mover">Local movers</option><option value="van_line">Van lines</option><option value="local_mover,van_line">Local movers + van lines</option><option value="broker">Brokers</option></select>
        <select aria-label="Business registry" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.sos} onChange={set('sos')}><option value="">Any registry status</option><option value="active">Active with the state</option><option value="inactive">Not active with the state</option></select>
        <select aria-label="Website" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.site} onChange={set('site')}><option value="">With or without website</option><option value="1">Has a website</option><option value="0">No website</option></select>
        <select aria-label="New companies" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.newDays} onChange={set('newDays')}><option value="">Any registration date</option><option value="30">Registered in the last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 6 months</option><option value="365">Last year</option><option value="730">Last 2 years</option></select>
        <select aria-label="Tracked" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.tracked} onChange={set('tracked')}><option value="">Tracked or not</option><option value="1">Tracked competitors</option><option value="0">Not tracked yet</option></select>
        <div className="flex flex-wrap gap-3 items-center text-sm lg:col-span-2">
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.hhg} onChange={set('hhg')} />Federal moving authority</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.likely} onChange={set('likely')} />Movers only</label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">{loading ? 'Searching…' : data ? <><b className="text-primary">{data.total.toLocaleString()}</b> companies · {data.totals.units.toLocaleString()} trucks · {data.totals.drivers.toLocaleString()} drivers{data.mode === 'national' ? (data.nationalComplete ? ' nationwide' : ' nationwide (some states still loading: their 300 biggest shown)') : ''}{data.updatedAt ? ` · data from ${new Date(data.updatedAt).toLocaleDateString()}` : ''}</> : ''}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy || !data?.total} onClick={async () => { if (!confirm(`Add the top ${Math.min(300, data?.total || 0)} of this list to your main competitor list?`)) return; const r = await post({ action: 'track', query: queryObject(), limit: 300, tier: 'challenger' }, 'track'); if (r) { toast({ title: `Added ${r.added} to your main list`, description: r.skipped ? `${r.skipped} were already tracked.` : undefined }); void load(); } }}>{busy === 'track' ? 'Adding…' : 'Track top 300 as main list'}</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => { if (!confirm('Add the 100 biggest movers in the country to your legends list? Brokers and non-movers are left out once Jev has sorted them.')) return; const r = await post({ action: 'legends' }, 'legends'); if (r) toast({ title: `Added ${r.added} legends`, description: r.skipped ? `${r.skipped} were already tracked.` : undefined }); }}>{busy === 'legends' ? 'Adding…' : 'Set national top 100 as legends'}</Button>
          {data?.jev && <Button size="sm" variant="outline" disabled={!!busy || !data?.rows.length} onClick={async () => { const r = await post({ action: 'classify', dots: data!.rows.filter(x => !x.kind).slice(0, 40).map(x => ({ dot: x.dot, state: x.state })) }, 'classify'); if (r) { toast({ title: `Jev sorted ${r.classified} companies` }); void load(); } }}>{busy === 'classify' ? 'Sorting…' : 'Sort this page with Jev'}</Button>}
          <Button size="sm" variant="outline" disabled={!!busy || !data?.total} onClick={exportCsv}>{busy === 'csv' ? 'Exporting…' : 'Export CSV'}</Button>
        </div>
      </div>
    </CardContent></Card>

    <Card className="bg-white"><CardContent className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground border-b">{['#', 'Company', 'Trucks', 'Drivers', 'Miles/yr', 'Years', 'Authority', 'Type', ''].map(h => <th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {(data?.rows || []).map((r, i) => <tr key={r.dot} className={`border-b last:border-0 hover:bg-slate-50 cursor-pointer ${selected?.dot === r.dot ? 'bg-blue-50' : ''}`} onClick={() => setSelected({ dot: r.dot, state: r.state })}>
            <td className="p-3 text-muted-foreground">{(page - 1) * 50 + i + 1}</td>
            <td className="p-3"><p className="font-bold text-primary">{nice(r.dba || r.name)}</p><p className="text-xs text-muted-foreground">{nice(r.city)}, {r.state}{r.site ? ` · ${r.site.replace(/^https?:\/\//, '')}` : ''}</p></td>
            <td className="p-3 font-semibold">{r.units}</td><td className="p-3">{r.drivers}</td><td className="p-3">{r.miles ? r.miles.toLocaleString() : '—'}</td><td className="p-3">{r.years || '—'}</td>
            <td className="p-3 text-xs whitespace-nowrap">{r.interstate ? 'Interstate' : 'In-state'}{r.hhgAuth ? ' · HHG' : ''}{r.mc ? <><br />{r.mc}</> : ''}</td>
            <td className="p-3">{r.kind ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${KIND_STYLE[r.kind]}`}>{KIND_LABEL[r.kind]}</span> : <span className="text-xs text-muted-foreground">—</span>}{r.sosActive === true && <Badge variant="outline" className="ml-1 text-[10px]">State: active</Badge>}{r.sosActive === false && <Badge variant="outline" className="ml-1 text-[10px] text-red-700">State: inactive</Badge>}</td>
            <td className="p-3">{r.competitorId && <Badge className="text-[10px]">Tracked</Badge>}</td>
          </tr>)}
          {data && !data.rows.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No companies match. Try a wider area or fewer filters.</td></tr>}
        </tbody>
      </table>
    </CardContent></Card>
    {pages > 1 && <div className="flex items-center gap-3 justify-center"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}

    {selected && <CompanyPanel dot={selected.dot} state={selected.state} onClose={() => setSelected(null)} onChanged={() => void load()} />}
  </div>;
}

function RankCard({ data, areaLabel, rankBy, setRankBy, onOpen }: { data: Result | null; areaLabel: string; rankBy: string; setRankBy: (v: string) => void; onOpen: (dot: string, state: string) => void }) {
  const r = data?.rank;
  return <Card className="bg-slate-900 text-white"><CardContent className="p-5 space-y-4">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Your rank · {areaLabel}</p>
      {r ? <p className="text-4xl font-black mt-1">#{r.rank.toLocaleString()} <span className="text-lg text-slate-400">of {r.of.toLocaleString()}</span></p> : <p className="text-sm text-slate-300 mt-2">Loading…</p>}
      <select aria-label="Rank by" className="mt-2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm" value={rankBy} onChange={e => setRankBy(e.target.value)}><option value="size">By overall size</option><option value="units">By trucks</option><option value="drivers">By drivers</option></select>
    </div>
    {r && r.nextUp.length > 0 && <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next to pass</p>
      {r.nextUp.map(m => <button key={m.dot} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-2 text-sm" onClick={() => onOpen(m.dot, m.state)}>
        <p className="font-bold">{nice(m.name)}</p>
        <p className="text-xs text-slate-300">{nice(m.city)}, {m.state} · {m.units} trucks · {m.drivers} drivers · needs +{m.gap.units} truck{m.gap.units === 1 ? '' : 's'}, +{m.gap.drivers} driver{m.gap.drivers === 1 ? '' : 's'}</p>
      </button>)}
    </div>}
    <p className="text-xs text-slate-400">Ranked on your fleet from Competitors → Our numbers (trucks and drivers, including your network). <Link className="underline" href="/dashboard/admin/competitors">Update them</Link>. Fleet is one measure; reviews and bookings are tracked per competitor.</p>
  </CardContent></Card>;
}

type Detail = {
  mover: Row & { cell: string; cdl: number; trucks: number; added: string; updated: string; safety: string; county: string; unitsReported: number; forHire: boolean; authActive: boolean };
  kind: string | null; kindLabel: string | null; kindConfidence: number | null; jev: boolean;
  sos: { best: { name: string; status: string; active: boolean | null; entityType: string; formed: string; agent: string; agentAddress: string; id: string; source: string; url: string | null } | null; matches: unknown[]; free: boolean; checkedAt: string | null } | null;
  sosSearchUrl: string; insurance: { type: string; insurer: string; policy: string; coverage: number; effective: string }[]; competitorId: string | null; links: Record<string, string>;
};

function CompanyPanel({ dot, state, onClose, onChanged }: { dot: string; state: string; onClose: () => void; onChanged: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState('');
  const url = `/api/admin/registry/${dot}?state=${state}`;
  const load = useCallback(() => apiFetch<Detail>(auth, url).then(setD).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load company', description: e instanceof Error ? e.message : '' })), [auth, url, toast]);
  useEffect(() => { setD(null); void load(); }, [load]);
  const act = async (action: string, extra: Record<string, unknown> = {}, ok?: string) => {
    setBusy(action);
    try { await apiFetch(auth, url, { action, ...extra }); if (ok) toast({ title: ok }); await load(); onChanged(); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const m = d?.mover;
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div><p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p><div className="text-sm">{children || '—'}</div></div>;

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Company details">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative w-full max-w-xl h-full bg-white overflow-y-auto p-6 space-y-6 shadow-2xl">
      <div className="flex justify-between gap-3">
        <div>{m ? <><h2 className="text-2xl font-black text-primary">{nice(m.dba || m.name)}</h2>{m.dba && <p className="text-sm text-muted-foreground">Legal name: {m.name}</p>}</> : <p>Loading…</p>}</div>
        <Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
      </div>
      {m && d && <>
        <div className="flex flex-wrap gap-2">
          {d.competitorId ? <Button asChild size="sm"><Link href="/dashboard/admin/competitors">Tracked: open competitors</Link></Button> : <>
            <Button size="sm" disabled={!!busy} onClick={() => act('track', { tier: 'challenger' }, 'Added to your main list')}>Track (main list)</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('track', { tier: 'legend' }, 'Added to legends')}>Track as legend</Button>
          </>}
        </div>

        <section className="grid grid-cols-2 gap-4">
          <Field label="USDOT">{m.dot}</Field><Field label="MC (docket)">{m.mc}</Field>
          <Field label="Entity type">{nice(m.org)}</Field><Field label="Company officer">{nice(m.officer)}</Field>
          <Field label="Address">{nice(m.street)}<br />{nice(m.city)}, {m.state} {m.zip}</Field>
          <Field label="Contact">{m.phone && <a className="underline" href={`tel:${m.phone}`}>{phone(m.phone)}</a>}{m.cell && m.cell !== m.phone && <><br />Cell: {phone(m.cell)}</>}{m.email && <><br /><a className="underline break-all" href={`mailto:${m.email}`}>{m.email}</a></>}</Field>
          <Field label="Website">{m.site ? <a className="underline break-all" href={m.site} target="_blank" rel="noreferrer noopener">{m.site.replace(/^https?:\/\//, '')}</a> : 'Not on file (no company email domain)'}</Field>
          <Field label="In business">{m.years ? `${m.years} years (DOT since ${m.added})` : m.added}</Field>
          <Field label="Fleet">{m.units} power units{m.unitsReported !== m.units ? ` (filed ${m.unitsReported}, likely a typo)` : ''} · {m.trucks} trucks</Field>
          <Field label="Drivers">{m.drivers} ({m.cdl} with CDL)</Field>
          <Field label="Miles per year">{m.miles ? m.miles.toLocaleString() : '—'}</Field>
          <Field label="Operation">{m.interstate ? 'Interstate' : 'In-state only'} · {m.forHire ? 'for hire' : 'private'}{m.hhgAuth ? ' · household goods authority' : ''}{m.broker ? ' · broker authority' : ''}</Field>
          <Field label="Safety rating">{({ S: 'Satisfactory', C: 'Conditional', U: 'Unsatisfactory' } as Record<string, string>)[m.safety] || 'Not rated'}</Field>
          <Field label="Last federal update">{m.updated}</Field>
        </section>

        <section className="space-y-2 bg-slate-50 rounded-xl p-4">
          <div className="flex justify-between items-center"><p className="font-bold">Company type (Jev)</p>{d.jev && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('classify', {}, 'Jev sorted this company')}>{busy === 'classify' ? 'Asking Jev…' : d.kind ? 'Ask again' : 'Ask Jev'}</Button>}</div>
          {d.kind ? <p className="text-sm"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${KIND_STYLE[d.kind]}`}>{KIND_LABEL[d.kind]}</span> {d.kindConfidence !== null && <span className="text-xs text-muted-foreground">({Math.round(d.kindConfidence * 100)}% confident)</span>}<br /><span className="text-muted-foreground">{d.kindLabel}</span></p>
            : <p className="text-sm text-muted-foreground">{d.jev ? 'Not sorted yet. The hourly job sorts each state’s biggest movers automatically.' : 'Jev isn’t configured.'}</p>}
          <p className="text-xs text-muted-foreground">Mover likelihood from federal data: {m.moverScore}/100</p>
        </section>

        <section className="space-y-2 bg-slate-50 rounded-xl p-4">
          <div className="flex justify-between items-center"><p className="font-bold">State business registry</p><Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('sos', {}, 'Registry checked')}>{busy === 'sos' ? 'Checking…' : d.sos?.checkedAt ? 'Check again' : 'Check now'}</Button></div>
          {d.sos?.best ? <div className="grid grid-cols-2 gap-3">
            <Field label="Registered name">{d.sos.best.name}</Field><Field label="Status">{d.sos.best.status}</Field>
            <Field label="Entity type">{d.sos.best.entityType}</Field><Field label="Formed">{d.sos.best.formed}</Field>
            <Field label="Registered agent">{d.sos.best.agent}{d.sos.best.agentAddress && <><br /><span className="text-xs">{d.sos.best.agentAddress}</span></>}</Field>
            <Field label="State ID">{d.sos.best.id}</Field>
            <p className="col-span-2 text-xs text-muted-foreground">Source: {d.sos.best.source}{d.sos.checkedAt ? `, checked ${new Date(d.sos.checkedAt).toLocaleDateString()}` : ''}. Matched by name; confirm it’s the same company.</p>
          </div> : d.sos?.checkedAt && d.sos.free ? <p className="text-sm text-muted-foreground">No matching registration found under this name.</p>
            : <p className="text-sm text-muted-foreground">{['CO', 'CT', 'NY', 'OR', 'TX'].includes(m.state) ? 'Click “Check now” to look it up in the state’s free registry data.' : `${m.state} doesn’t publish its business registry as free data.`} <a className="underline" href={d.sosSearchUrl} target="_blank" rel="noreferrer noopener">Search the {m.state} registry</a></p>}
        </section>

        <section className="space-y-2">
          <p className="font-bold">Insurance on file with FMCSA</p>
          {d.insurance.length ? <ul className="text-sm space-y-1">{d.insurance.slice(0, 6).map((x, i) => <li key={i}>{x.type}: {x.insurer} · ${x.coverage.toLocaleString()} · since {x.effective}</li>)}</ul> : <p className="text-sm text-muted-foreground">{m.mc ? 'No filings found.' : 'No MC number, so no federal insurance filings (in-state movers file with their state).'}</p>}
        </section>

        <section className="flex flex-wrap gap-2 text-sm">
          {Object.entries({ safer: 'FMCSA SAFER', sms: 'FMCSA safety (SMS)', google: 'Google reviews', maps: 'Google Maps', yelp: 'Yelp', bbb: 'BBB' }).map(([k, l]) => <a key={k} className="underline" href={d.links[k]} target="_blank" rel="noreferrer noopener">{l}</a>)}
        </section>
      </>}
    </div>
  </div>;
}

export default function MoverRegistryPage() { return <EmployeeLayout isAdmin><Registry /></EmployeeLayout>; }
