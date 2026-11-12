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
import { REGISTRY_AREAS } from '@/lib/registry';
import { REGION_PRESETS } from '@/lib/regions';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, PARTNER_KEYS, categoriesOf } from '@/lib/carriers';
import type { Bounds, MapPoint, StateStat } from '@/components/registry/mover-map';
import { ResearchPanel } from '@/components/agents/research-panel';
import { SOCIAL_SCORE_HELP, type PlatformStats, type SocialSummary } from '@/lib/social-stats';
import { SAFETY_HELP, type Safety } from '@/lib/safety';

const MoverMap = dynamic(() => import('@/components/registry/mover-map').then(m => m.MoverMap), { ssr: false, loading: () => <div className="h-[420px] md:h-[520px] rounded-2xl bg-slate-100 animate-pulse" /> });

type Row = {
  dot: string; mc: string; name: string; dba: string; street: string; city: string; state: string; zip: string; phone: string; email: string; site: string; officer: string; org: string;
  units: number; drivers: number; miles: number; years: number; interstate: boolean; hhgAuth: boolean; broker: boolean; moverScore: number;
  kind: string | null; sosActive: boolean | null; competitorId: string | null; cats?: number; otherCargo?: string;
  partnerScore?: number; partnerReasons?: string[]; partnerFit?: string | null; partnerFitConfidence?: number | null;
};
type ImportStatus = { generatedAt: string; runs: number; sourceUpdatedAt: string | null; schedule: string; nextCheck: string; totals: { rows: number; active: number; movers: number; carriers: number; partners?: number; newPartners?: number; categories: Record<string, number> }; columns: { added: string[]; removed: string[]; count: number }; dictionary: { name: string; changedAt: string; checkedAt: string; previousName: string | null } | null };
type Rank = { rank: number; of: number; nextUp: { dot: string; name: string; city: string; state: string; units: number; drivers: number; years: number; gap: { units: number; drivers: number; years: number } }[] };
type Explain = { formula: string; ours: { trucks: number; drivers: number; miles: number; total: number }; rank: number; of: number; nextUp: { dot: string; name: string; city: string; state: string; units: number; drivers: number; years: number; score: { total: number }; need: { points: number; trucks: number; drivers: number } }[]; measures: { label: string; ours: number; rank: number; of: number; leader: number; median: number; unit: string }[]; shares: { authority: number; website: number }; steps: string[] };
type Result = { needsArea?: boolean; import?: ImportStatus | null; mode: 'national' | 'detailed'; nationalComplete?: boolean | null; explain?: Explain | null; total: number; rows: Row[]; rank: Rank | null; points?: MapPoint[]; totals: { units: number; drivers: number }; updatedAt: string | null; synced: number; jev: boolean; stateStats?: (StateStat & { count: number; updatedAt: string | null })[] };

const KIND_LABEL: Record<string, string> = { local_mover: 'Local mover', van_line: 'Van line', broker: 'Broker', freight: 'Freight', other: 'Not a mover' };
const FIT_LABEL: Record<string, string> = { moving_help: 'Could do moving work', vehicle_transport: 'Ships cars', linehaul: 'Overflow / long-distance hauling', storage_container: 'Containers & storage', broker: 'Broker (doesn’t haul)', not_fit: 'Not a fit' };
const FIT_STYLE: Record<string, string> = { moving_help: 'bg-green-100 text-green-800', vehicle_transport: 'bg-green-100 text-green-800', linehaul: 'bg-blue-100 text-blue-800', storage_container: 'bg-blue-100 text-blue-800', broker: 'bg-amber-100 text-amber-800', not_fit: 'bg-red-100 text-red-800' };
const KIND_STYLE: Record<string, string> = { local_mover: 'bg-green-100 text-green-800', van_line: 'bg-blue-100 text-blue-800', broker: 'bg-amber-100 text-amber-800', freight: 'bg-slate-200 text-slate-700', other: 'bg-red-100 text-red-800' };
// Every metro, A–Z, for the city picker.
const METRO_OPTIONS = Object.entries(REGION_PRESETS).filter(([, r]) => r.kind === 'metro').sort((a, b) => a[1].label.localeCompare(b[1].label));
const FOCUS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'bay-area': { lat: 37.65, lng: -122.1, zoom: 9 }, 'puget-sound': { lat: 47.5, lng: -122.3, zoom: 9 }, socal: { lat: 34.0, lng: -118.1, zoom: 9 }, national: { lat: 39.5, lng: -98.5, zoom: 4 },
};
const SORTS = { score: 'Best partner fit', size: 'Biggest overall', units: 'Most trucks', drivers: 'Most drivers', miles: 'Most miles', years: 'Longest in business', newest: 'Newest registered first', name: 'Name A–Z' } as const;
const phone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const nice = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());

function Registry() {
  const auth = useAuth();
  const { toast } = useToast();
  const [area, setArea] = useState<string>('bay-area'); // region preset, a state code, 'national' or 'map'
  const [f, setF] = useState({ type: '', q: '', city: '', minUnits: '', minDrivers: '', minYears: '', newDays: '', interstate: '', hhg: false, likely: true, site: '', kind: '', sos: '', tracked: '', sort: 'size', rankBy: 'size' });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(FOCUS['bay-area']);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ dot: string; state: string } | null>(null);
  // Links from other pages (e.g. Legends) open a company: ?dot=123&state=CA.
  useEffect(() => { const q = new URLSearchParams(window.location.search); const dot = q.get('dot'), st = q.get('state'); if (dot && st) setSelected({ dot, state: st.toUpperCase() }); }, []);
  const [busy, setBusy] = useState('');
  const [stateTotals, setStateTotals] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const params = useMemo(() => {
    const p = new URLSearchParams({ sort: f.sort, rankBy: f.rankBy, page: String(page), pageSize: '50', map: '1', stats: '1' });
    // The list's area: a preset region, a state/province, the map view, or (otherwise) the whole country.
    if (area === 'map' && bounds) for (const k of ['south', 'west', 'north', 'east'] as const) p.set(k, bounds[k].toFixed(4));
    else if (REGION_PRESETS[area]) p.set('region', area);
    else if (REGISTRY_AREAS.includes(area)) p.set('states', area);
    // Map pins always cover the visible map, whatever area the list uses.
    if (bounds) { p.set('vbSouth', bounds.south.toFixed(3)); p.set('vbWest', bounds.west.toFixed(3)); p.set('vbNorth', bounds.north.toFixed(3)); p.set('vbEast', bounds.east.toFixed(3)); }
    if (f.type) p.set('type', f.type);
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
    const preset = REGION_PRESETS[a];
    if (FOCUS[a]) setFocus(FOCUS[a]);
    else if (preset?.center) setFocus({ lat: preset.center[0], lng: preset.center[1], zoom: preset.states.length > 1 ? 8 : 9 });
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
  const downloadDictionary = async () => {
    setBusy('pdf');
    try {
      const user = auth.currentUser; if (!user) return;
      const res = await fetch('/api/admin/registry/dictionary', { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!res.ok) throw new Error('The data dictionary isn’t available yet.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = data?.import?.dictionary?.name || 'MCMIS_Company_Census_Data_Dictionary.pdf'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast({ variant: 'destructive', title: 'Download failed', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const exportCsv = async () => {
    setBusy('csv');
    try {
      const user = auth.currentUser; if (!user) return;
      const p = new URLSearchParams(params); p.set('format', 'csv'); p.delete('map'); p.delete('stats');
      const res = await fetch(`/api/admin/registry?${p}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!res.ok) throw new Error('Export failed.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `${f.type === 'partners' ? 'partners' : f.type ? 'carriers' : 'movers'}-${area}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast({ variant: 'destructive', title: 'Export failed', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };

  const areaLabel = REGION_PRESETS[area]?.label || (area === 'national' ? 'Whole country' : area === 'map' ? 'Map view' : area);
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const notSynced = data && data.synced === 0;

  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Mover registry</h1>
      <p className="text-muted-foreground">Every active U.S. moving company registered with the Department of Transportation (the free FMCSA Company Census), plus every other for-hire carrier sorted by what they haul: freight, car carriers and more are future partners and agents. Search any area, see where you rank, and add companies to your competitor lists.</p>
    </div>

    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm font-semibold">Show:</span>
      <select aria-label="Kind of carrier" className="h-9 border rounded-md px-2 bg-white text-sm font-semibold" value={f.type} onChange={e => { const type = e.target.value; setF({ ...f, type, sort: type === 'partners' ? 'score' : f.sort === 'score' ? 'size' : f.sort }); setPage(1); }}>
        <option value="">Moving companies</option>
        <option value="partners">Partner shortlist: best partners and agents{data?.import?.totals.partners ? ` (of ${data.import.totals.partners.toLocaleString()})` : ''}</option>
        <optgroup label="Possible partners and agents">{CATEGORIES.filter(c => c.partner && c.key !== 'household').map(c => <option key={c.key} value={c.key}>{c.label}{data?.import?.totals.categories[c.key] ? ` (${data.import.totals.categories[c.key].toLocaleString()})` : ''}</option>)}</optgroup>
        <optgroup label="Other industries">{CATEGORIES.filter(c => !c.partner).map(c => <option key={c.key} value={c.key}>{c.label}{data?.import?.totals.categories[c.key] ? ` (${data.import.totals.categories[c.key].toLocaleString()})` : ''}</option>)}</optgroup>
      </select>
      {f.type === 'partners' && <p className="text-xs text-muted-foreground">Each state’s best 3,000 freight, car-carrier, container, mobile-home and mail carriers (movers aren’t included: they’re in the mover list), scored 0–100 on fleet, years in business, active insured authority, interstate, website and the kind of hauling. AI says how each could work with you.</p>}
      {f.type && f.type !== 'partners' && <p className="text-xs text-muted-foreground">Categories come from the cargo each company lists on its federal filing; many haul several kinds. Private fleets and bus/limo companies are left out.</p>}
    </div>
    {f.type && data?.needsArea && <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4 text-sm">There are too many {f.type === 'partners' ? 'partner candidates' : `${CATEGORY_LABEL[f.type as keyof typeof CATEGORY_LABEL]?.toLowerCase()} carriers`} to list nationwide. Pick a state or region, or zoom the map in to a few states. The map’s state totals show the counts everywhere.</CardContent></Card>}
    {f.type && !data?.import && data && <Card className="bg-amber-50 border-amber-200"><CardContent className="p-4 text-sm">Other carriers appear after the first import of the full DOT census file (it runs every day for the first three days, then weekly).</CardContent></Card>}

    {notSynced && <Card className="bg-amber-50 border-amber-200"><CardContent className="p-4 text-sm space-y-2">
      <p className="font-bold">The registry is loading for the first time.</p>
      <p>The daily import fills all 50 states within a few hours of going live, starting with California and Washington. You can load a state now:</p>
      <div className="flex gap-2 flex-wrap">{['CA', 'WA'].map(s => <Button key={s} size="sm" disabled={!!busy} onClick={async () => { const r = await post({ action: 'sync', state: s }, `sync-${s}`); if (r) { toast({ title: `${s} loaded`, description: `${r.likely.toLocaleString()} likely movers of ${r.count.toLocaleString()} registered.` }); void load(); } }}>{busy === `sync-${s}` ? `Loading ${s}…` : `Load ${s} now`}</Button>)}</div>
    </CardContent></Card>}

    <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" variant={area === 'national' ? 'default' : 'outline'} onClick={() => chooseArea('national')}>Whole country</Button>
      {Object.entries(REGION_PRESETS).filter(([, r]) => r.kind === 'region').map(([k, r]) => <Button key={k} size="sm" variant={area === k ? 'default' : 'outline'} onClick={() => chooseArea(k)}>{r.label}</Button>)}
      <select aria-label="City" className="h-9 border rounded-md px-2 bg-white text-sm max-w-[16rem]" value={REGION_PRESETS[area]?.kind === 'metro' ? area : ''} onChange={e => e.target.value && chooseArea(e.target.value)}>
        <option value="">A city…</option>{METRO_OPTIONS.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
      </select>
      <Button size="sm" variant={area === 'map' ? 'default' : 'outline'} onClick={() => { setArea('map'); setPage(1); }}>Whatever the map shows</Button>
      <select aria-label="State" className="h-9 border rounded-md px-2 bg-white text-sm" value={REGISTRY_AREAS.includes(area) ? area : ''} onChange={e => e.target.value && chooseArea(e.target.value)}>
        <option value="">A state…</option>{REGISTRY_AREAS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>

    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-2">
        <MoverMap points={data?.points || []} stateStats={(data?.stateStats || []) as StateStat[]} focus={focus}
          onBounds={b => { setBounds(b); if (area === 'map') setPage(1); }} onSelect={(dot, state) => setSelected({ dot, state })} onState={s => { setStateTotals(false); chooseArea(s); }} highlight={selected?.dot} stateTotals={stateTotals} />
        {f.type === 'partners' && <div className="flex flex-wrap gap-3 text-xs" aria-label="Map colors">{PARTNER_KEYS.map(k => <span key={k} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: CATEGORY_COLOR[k] }} />{CATEGORY_LABEL[k]}</span>)}</div>}
        <div className="flex flex-wrap justify-between gap-2 items-center"><p className="text-xs text-muted-foreground">{f.type === 'partners' ? 'Colors: each carrier’s main kind of hauling (above).' : 'Red: 20+ trucks · Orange: 5–19 · Gray: under 5.'} The map shows every company in view, anywhere you pan (with your filters); numbers are clusters, zoom in to split them. Pins sit at each company’s ZIP code. {area !== 'map' && `The list below is ${areaLabel}; choose “Whatever the map shows” to list what’s on screen.`}</p><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={stateTotals} onChange={e => setStateTotals(e.target.checked)} />Show state totals instead</label></div>
      </div>
      {f.type ? <ImportCard status={data?.import || null} busy={busy === 'pdf'} onDictionary={downloadDictionary} /> : <RankCard data={data} areaLabel={areaLabel} rankBy={f.rankBy} setRankBy={v => setF({ ...f, rankBy: v })} onOpen={(dot, state) => setSelected({ dot, state })} />}
    </div>
    {!f.type && <ImportCard status={data?.import || null} busy={busy === 'pdf'} onDictionary={downloadDictionary} compact />}

    <Card className="bg-white"><CardContent className="p-4 space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <Input placeholder="Name, DOT, MC or owner" value={f.q} onChange={set('q')} className="lg:col-span-2" />
        <Input placeholder="City" value={f.city} onChange={set('city')} />
        <Input placeholder="Min trucks" inputMode="numeric" value={f.minUnits} onChange={set('minUnits')} />
        <Input placeholder="Min drivers" inputMode="numeric" value={f.minDrivers} onChange={set('minDrivers')} />
        <Input placeholder="Min years in business" inputMode="numeric" value={f.minYears} onChange={set('minYears')} />
        <select aria-label="Sort" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.sort} onChange={set('sort')}>{Object.entries(SORTS).filter(([k]) => k !== 'score' || f.type === 'partners').map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}</select>
        <select aria-label="Interstate" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.interstate} onChange={set('interstate')}><option value="">Local & interstate</option><option value="yes">Interstate only</option><option value="no">In-state only</option></select>
        <select aria-label="Company type" className="h-10 border rounded-md px-2 bg-white text-sm" value={f.kind} onChange={set('kind')}><option value="">Any company type</option><option value="local_mover">Local movers</option><option value="van_line">Van lines</option><option value="local_mover,van_line">Local movers + van lines</option><option value="broker">Brokers</option></select>
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
          <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => { if (!confirm('Add the 100 biggest movers in the country to your legends list? Brokers and non-movers are left out once AI has sorted them.')) return; const r = await post({ action: 'legends' }, 'legends'); if (r) toast({ title: `Added ${r.added} legends`, description: r.skipped ? `${r.skipped} were already tracked.` : undefined }); }}>{busy === 'legends' ? 'Adding…' : 'Set national top 100 as legends'}</Button>
          {f.type === 'partners' && <Button size="sm" disabled={!!busy || !data?.rows.length} onClick={async () => { const pick = data!.rows.filter(x => x.partnerFit !== 'not_fit' && x.partnerFit !== 'broker'); if (!confirm(`Add the ${pick.length} carriers on this page to Agent network → Recruiting? (AI “not a fit” and brokers are skipped.)`)) return; const r = await post({ action: 'recruit', dots: pick.map(x => ({ dot: x.dot, state: x.state })) }, 'recruit'); if (r) toast({ title: `Added ${r.added} to recruiting`, description: r.skipped ? `${r.skipped} were already on the list.` : undefined }); }}>{busy === 'recruit' ? 'Adding…' : 'Add this page to recruiting'}</Button>}
          {data?.jev && f.type === 'partners' && <Button size="sm" variant="outline" disabled={!!busy || !data?.rows.length} onClick={async () => { const r = await post({ action: 'classify', partners: true, dots: data!.rows.filter(x => !x.partnerFit).slice(0, 40).map(x => ({ dot: x.dot, state: x.state })) }, 'classify'); if (r) { toast({ title: `AI sorted ${r.classified} carriers` }); void load(); } }}>{busy === 'classify' ? 'Sorting…' : 'Ask AI how they could partner'}</Button>}
          {data?.jev && f.type !== 'partners' && <Button size="sm" variant="outline" disabled={!!busy || !data?.rows.length} onClick={async () => { const r = await post({ action: 'classify', dots: data!.rows.filter(x => !x.kind).slice(0, 40).map(x => ({ dot: x.dot, state: x.state })) }, 'classify'); if (r) { toast({ title: `AI sorted ${r.classified} companies` }); void load(); } }}>{busy === 'classify' ? 'Sorting…' : 'Sort this page with AI'}</Button>}
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
            <td className="p-3">{r.partnerScore !== undefined && <p className="text-xs mb-1" title={(r.partnerReasons || []).join(', ')}><b className="text-primary">Fit {r.partnerScore}/100</b>{r.partnerFit && <span className={`ml-1 px-2 py-0.5 rounded-full font-semibold ${FIT_STYLE[r.partnerFit]}`}>{FIT_LABEL[r.partnerFit]}</span>}</p>}{r.kind ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${KIND_STYLE[r.kind]}`}>{KIND_LABEL[r.kind]}</span> : <span className="text-xs text-muted-foreground">—</span>}{r.cats ? <span className="flex flex-wrap gap-1 mt-1">{categoriesOf(r.cats).map(k => <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{CATEGORY_LABEL[k]}</span>)}{r.otherCargo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{r.otherCargo.toLowerCase()}</span>}</span> : null}{r.sosActive === true && <Badge variant="outline" className="ml-1 text-[10px]">State: active</Badge>}{r.sosActive === false && <Badge variant="outline" className="ml-1 text-[10px] text-red-700">State: inactive</Badge>}</td>
            <td className="p-3">{r.competitorId ? <Badge className="text-[10px]">Tracked</Badge> : <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!busy} onClick={async e => { e.stopPropagation(); setBusy(`track-${r.dot}`); try { await apiFetch(auth, `/api/admin/registry/${r.dot}?state=${r.state}`, { action: 'track', tier: 'challenger' }); toast({ title: `${nice(r.dba || r.name)} added to competitors` }); void load(); } catch (err) { toast({ variant: 'destructive', title: 'That didn’t work', description: err instanceof Error ? err.message : '' }); } finally { setBusy(''); } }}>{busy === `track-${r.dot}` ? '…' : 'Track'}</Button>}</td>
          </tr>)}
          {data && !data.rows.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No companies match. Try a wider area or fewer filters.</td></tr>}
        </tbody>
      </table>
    </CardContent></Card>
    {pages > 1 && <div className="flex items-center gap-3 justify-center"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}

    {selected && <CompanyPanel dot={selected.dot} state={selected.state} onClose={() => setSelected(null)} onChanged={() => void load()} />}
  </div>;
}

/** When the DOT census file was last imported, the refresh schedule, and the data dictionary PDF. */
function ImportCard({ status, busy, onDictionary, compact }: { status: ImportStatus | null; busy: boolean; onDictionary: () => void; compact?: boolean }) {
  if (!status) return compact ? null : <Card className="bg-white"><CardContent className="p-5 text-sm text-muted-foreground">The full DOT census file hasn’t been imported yet.</CardContent></Card>;
  const d = status.dictionary, fresh = d && Date.now() - Date.parse(d.changedAt) < 8 * 86400000 && d.previousName;
  const changed = status.columns.added.length + status.columns.removed.length > 0;
  return <Card className="bg-white"><CardContent className={`${compact ? 'p-4' : 'p-5'} text-sm space-y-2`}>
    <p className="font-bold">DOT census file</p>
    <p className="text-muted-foreground">Imported {new Date(status.generatedAt).toLocaleString()} ({status.totals.rows.toLocaleString()} records, {status.totals.active.toLocaleString()} active, {status.totals.movers.toLocaleString()} household-goods carriers, {status.totals.carriers.toLocaleString()} for-hire carriers{status.totals.partners ? `, ${status.totals.partners.toLocaleString()} possible partners` : ''}{status.totals.newPartners ? `, ${status.totals.newPartners.toLocaleString()} of them new since the last import` : ''}). Refresh: {status.schedule}; {status.nextCheck}.</p>
    {changed && <p className="text-amber-800">The DOT changed the file’s columns: {status.columns.added.length ? `added ${status.columns.added.join(', ')}` : ''}{status.columns.added.length && status.columns.removed.length ? '; ' : ''}{status.columns.removed.length ? `removed ${status.columns.removed.join(', ')}` : ''}. Check the data dictionary.</p>}
    {d && <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={onDictionary}>{busy ? 'Downloading…' : 'Download the data dictionary (PDF)'}</Button><span className="text-xs text-muted-foreground">{d.name} · checked {new Date(d.checkedAt).toLocaleDateString()}</span>{fresh && <Badge className="text-[10px]">New version</Badge>}</div>}
  </CardContent></Card>;
}

function RankCard({ data, areaLabel, rankBy, setRankBy, onOpen }: { data: Result | null; areaLabel: string; rankBy: string; setRankBy: (v: string) => void; onOpen: (dot: string, state: string) => void }) {
  const r = data?.rank, x = data?.explain;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return <Card className="bg-slate-900 text-white"><CardContent className="p-5 space-y-4">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Your rank · {areaLabel}</p>
      {r ? <p className="text-4xl font-black mt-1">#{r.rank.toLocaleString()} <span className="text-lg text-slate-400">of {r.of.toLocaleString()}</span></p> : <p className="text-sm text-slate-300 mt-2">Loading…</p>}
      <select aria-label="Rank by" className="mt-2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm" value={rankBy} onChange={e => setRankBy(e.target.value)}><option value="size">By overall size</option><option value="units">By trucks</option><option value="drivers">By drivers</option></select>
    </div>
    {x && <details className="bg-white/5 rounded-lg p-3 text-sm" open>
      <summary className="cursor-pointer font-bold">How this is calculated</summary>
      <p className="text-slate-300 mt-2">{x.formula}</p>
      <p className="mt-1">Your score: <b>{x.ours.total}</b> <span className="text-slate-400">({x.ours.trucks} from trucks + {x.ours.drivers} from drivers{x.ours.miles ? ` + ${x.ours.miles} from miles` : ''})</span></p>
      <table className="w-full mt-3 text-xs"><thead><tr className="text-slate-400 text-left"><th className="py-1 font-medium">Measure</th><th className="font-medium">You</th><th className="font-medium">Your rank</th><th className="font-medium">Typical</th><th className="font-medium">Leader</th></tr></thead>
        <tbody>{x.measures.map(m => <tr key={m.label} className="border-t border-white/10"><td className="py-1">{m.label}</td><td>{m.ours}</td><td>#{m.rank.toLocaleString()} of {m.of.toLocaleString()}</td><td>{m.median}</td><td>{m.leader}</td></tr>)}
          <tr className="border-t border-white/10"><td className="py-1">Interstate authority</td><td colSpan={4}>{x.shares.authority}% of movers here have it</td></tr></tbody></table>
    </details>}
    {x && x.nextUp.length > 0 && <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next to pass</p>
      {x.nextUp.map(m => <button key={m.dot} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-2 text-sm" onClick={() => onOpen(m.dot, m.state)}>
        <p className="font-bold">{nice(m.name)} <span className="text-slate-400 font-normal">· score {m.score.total}</span></p>
        <p className="text-xs text-slate-300">{nice(m.city)}, {m.state} · {plural(m.units, 'truck')} · {plural(m.drivers, 'driver')} · to pass: +{plural(m.need.trucks, 'truck')} or +{plural(m.need.drivers, 'driver')}</p>
      </button>)}
    </div>}
    {x && <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">How to move up</p><ol className="list-decimal pl-5 text-sm space-y-1 text-slate-200">{x.steps.map((st, i) => <li key={i}>{st}</li>)}</ol></div>}
    <p className="text-xs text-slate-400">Your numbers come from Competitors → Our numbers. <Link className="underline" href="/dashboard/admin/competitors">Update them</Link>.</p>
  </CardContent></Card>;
}

type Detail = {
  mover: Row & { cell: string; cdl: number; trucks: number; added: string; updated: string; safety: string; county: string; unitsReported: number; forHire: boolean; authActive: boolean };
  kind: string | null; kindLabel: string | null; kindConfidence: number | null; jev: boolean;
  sos: { best: { name: string; status: string; active: boolean | null; entityType: string; formed: string; agent: string; agentAddress: string; id: string; source: string; url: string | null } | null; matches: unknown[]; free: boolean; checkedAt: string | null } | null;
  sosSearchUrl: string; insurance: { type: string; insurer: string; policy: string; coverage: number; effective: string }[]; competitorId: string | null; links: Record<string, string>;
  web: Web | null; searchReady: boolean; braveReady: boolean; places: { ready: boolean; usage: PlacesUsage | null };
  statsReady: { instagram: boolean; youtube: boolean }; socialStats: Record<string, PlatformStats> | null; social: { summary: SocialSummary; score: number | null; activity: string } | null; strategy: string | null; safety: SafetyInfo | null;
};
type SafetyInfo = Safety & { checkedAt: string | null };
const STRATEGY: Record<string, { label: string; style: string; hint: string }> = {
  partner: { label: 'Partner', style: 'bg-green-100 text-green-800', hint: 'Agent or partner candidate for our network' },
  study: { label: 'Study', style: 'bg-blue-100 text-blue-800', hint: 'A legend to learn from' },
  compete: { label: 'Compete', style: 'bg-red-100 text-red-800', hint: 'Direct rival in the Bay Area' },
  acquire: { label: 'Acquire?', style: 'bg-purple-100 text-purple-800', hint: 'Possible buy-out target' },
  ignore: { label: 'Ignore', style: 'bg-slate-100 text-slate-600', hint: 'Not relevant to us' },
};
type PlacesUsage = { month: string; details: number; match: number; detailsCap: number; matchCap: number };
type GoogleInfo = { placeId: string; name: string; address: string; rating: number | null; reviews: number | null; website: string | null; phone: string | null; status: string | null; mapsUrl: string | null; hours: string[]; type: string | null };
type Web = { site: string | null; source: 'email' | 'guess' | 'google' | 'brave' | null; matchedBy: string[]; socials: Record<string, string>; possibleSocials: Record<string, string>; tried: { url: string; source: string; ok: boolean; matchedBy: string[]; error?: string }[]; searched: string[]; checkedAt: string | null };
const WEB_SOURCE: Record<string, string> = { email: 'their email domain on the federal filing', guess: 'a likely web address from their name', google: 'a Google search', brave: 'a Brave search', places: 'their Google Business listing' };
const SOCIAL_NAME: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', yelp: 'Yelp', google: 'Google', nextdoor: 'Nextdoor', bbb: 'BBB', thumbtack: 'Thumbtack', angi: 'Angi' };

function CompanyPanel({ dot, state, onClose, onChanged }: { dot: string; state: string; onClose: () => void; onChanged: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState('');
  const [research, setResearch] = useState(false);
  const url = `/api/admin/registry/${dot}?state=${state}`;
  const load = useCallback(() => apiFetch<Detail>(auth, url).then(setD).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load company', description: e instanceof Error ? e.message : '' })), [auth, url, toast]);
  useEffect(() => { setD(null); void load(); }, [load]);
  // First open: look up their website and social profiles automatically (cached for 30 days after).
  const [webBusy, setWebBusy] = useState(false);
  const findWeb = useCallback(async (refresh: boolean) => {
    setWebBusy(true);
    try { const web = await apiFetch<Web>(auth, url, { action: 'web', refresh }); setD(prev => prev ? { ...prev, web } : prev); }
    catch (e) { toast({ variant: 'destructive', title: 'Website search didn’t finish', description: e instanceof Error ? e.message : '' }); }
    finally { setWebBusy(false); }
  }, [auth, url, toast]);
  const onSafety = useCallback((safety: SafetyInfo) => setD(prev => prev ? { ...prev, safety } : prev), []);
  const autoRan = useRef('');
  useEffect(() => { if (d && !d.web && autoRan.current !== url) { autoRan.current = url; void findWeb(false); } }, [d, url, findWeb]);
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
          <Button size="sm" variant="outline" onClick={() => setResearch(true)}>Research for agent network</Button>
        </div>

        <section className="grid grid-cols-2 gap-4">
          <Field label="USDOT">{m.dot}</Field><Field label="MC (docket)">{m.mc}</Field>
          <Field label="Entity type">{nice(m.org)}</Field><Field label="Company officer">{nice(m.officer)}</Field>
          <Field label="Address">{nice(m.street)}<br />{nice(m.city)}, {m.state} {m.zip}</Field>
          <Field label="Contact">{m.phone && <a className="underline" href={`tel:${m.phone}`}>{phone(m.phone)}</a>}{m.cell && m.cell !== m.phone && <><br />Cell: {phone(m.cell)}</>}{m.email && <><br /><a className="underline break-all" href={`mailto:${m.email}`}>{m.email}</a></>}</Field>
          <Field label="Website">{(m.site || d.web?.site) ? <a className="underline break-all" href={m.site || d.web!.site!} target="_blank" rel="noreferrer noopener">{(m.site || d.web!.site!).replace(/^https?:\/\//, '')}</a> : webBusy ? 'Searching…' : 'None found'}</Field>
          <Field label="In business">{m.years ? `${m.years} years (DOT since ${m.added})` : m.added}</Field>
          <Field label="Fleet">{m.units} power units{m.unitsReported !== m.units ? ` (filed ${m.unitsReported}, likely a typo)` : ''} · {m.trucks} trucks</Field>
          <Field label="Drivers">{m.drivers} ({m.cdl} with CDL)</Field>
          <Field label="Miles per year">{m.miles ? m.miles.toLocaleString() : '—'}</Field>
          <Field label="Operation">{m.interstate ? 'Interstate' : 'In-state only'} · {m.forHire ? 'for hire' : 'private'}{m.hhgAuth ? ' · household goods authority' : ''}{m.broker ? ' · broker authority' : ''}</Field>
          <Field label="Safety rating">{({ S: 'Satisfactory', C: 'Conditional', U: 'Unsatisfactory' } as Record<string, string>)[m.safety] || 'Not rated'}</Field>
          <Field label="Last federal update">{m.updated}</Field>
        </section>

        <WebSection web={d.web} busy={webBusy} searchReady={d.searchReady} braveReady={d.braveReady} onRefresh={() => findWeb(true)} />
        {(d.statsReady.instagram || d.statsReady.youtube) && (d.web?.socials?.instagram || d.web?.socials?.youtube || d.socialStats) && <section className="space-y-2 bg-slate-50 rounded-xl p-4">
          <div className="flex justify-between items-center"><p className="font-bold">Social numbers</p><Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('social-stats', {}, 'Social numbers updated')}>{busy === 'social-stats' ? 'Checking…' : d.socialStats ? 'Update' : 'Get Instagram & YouTube numbers'}</Button></div>
          {d.social && <p className="text-sm">Social score <b>{d.social.score ?? '—'}</b> · {d.social.summary.followers?.toLocaleString() ?? '—'} followers · {d.social.summary.postsLast30 ?? '—'} posts in 30 days · last post {d.social.summary.daysSinceLastPost === null ? '—' : `${d.social.summary.daysSinceLastPost} days ago`}</p>}
          {d.socialStats && <ul className="text-xs space-y-0.5">{Object.values(d.socialStats).map(p => <li key={p.platform}><b className="capitalize">{p.platform}</b>: {p.error ? <span className="text-amber-700">{p.error}</span> : `${p.followers?.toLocaleString() ?? 'hidden'} followers · ${p.posts ?? '?'} posts · ${p.avgLikes ?? '?'} likes and ${p.avgComments ?? '?'} comments per post (last ${p.sampled})`}</li>)}</ul>}
          <p className="text-[11px] text-muted-foreground">{SOCIAL_SCORE_HELP}</p>
        </section>}
        <SafetySection url={url} safety={d.safety} onSafety={onSafety} />
        <GoogleSection url={url} places={d.places} onWeb={web => setD(prev => prev ? { ...prev, web } : prev)} />

        <section className="space-y-2 bg-slate-50 rounded-xl p-4">
          <div className="flex justify-between items-center"><p className="font-bold">Company type (AI)</p>{d.jev && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('classify', {}, 'AI sorted this company')}>{busy === 'classify' ? 'Asking AI…' : d.kind ? 'Ask again' : 'Ask AI'}</Button>}</div>
          {d.kind ? <p className="text-sm"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${KIND_STYLE[d.kind]}`}>{KIND_LABEL[d.kind]}</span> {d.kindConfidence !== null && <span className="text-xs text-muted-foreground">({Math.round(d.kindConfidence * 100)}% confident)</span>}<br /><span className="text-muted-foreground">{d.kindLabel}</span></p>
            : <p className="text-sm text-muted-foreground">{d.jev ? 'Not sorted yet. The hourly job sorts each state’s biggest movers automatically.' : 'AI sorting isn’t set up.'}</p>}
          {d.jev && <div className="flex flex-wrap items-center gap-2 text-sm pt-1"><span className="font-semibold">Jev’s call:</span>{d.strategy ? <span title={STRATEGY[d.strategy]?.hint} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STRATEGY[d.strategy]?.style}`}>{STRATEGY[d.strategy]?.label}</span> : <span className="text-muted-foreground">not asked yet</span>}{d.strategy && <span className="text-xs text-muted-foreground">{STRATEGY[d.strategy]?.hint}</span>}<Button size="sm" variant="ghost" className="h-7" disabled={!!busy} onClick={() => act('strategy', {}, 'Jev reviewed this company')}>{busy === 'strategy' ? 'Asking Jev…' : d.strategy ? 'Ask again' : 'Ask Jev how to treat them'}</Button></div>}
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
    {research && m && <ResearchPanel target={{ key: m.dot, dot: m.dot, state: m.state, name: nice(m.dba || m.name), city: `${nice(m.city)}, ${m.state}` }} onClose={() => setResearch(false)} />}
  </div>;
}

/**
 * Their Google Business listing, fetched live only when you click. Google's
 * terms don't allow keeping ratings, reviews or contact details, so this
 * disappears when the panel closes (only the place ID is saved).
 */
/** Activity, safety and trouble from DOT records; loads by itself when missing or over a week old. */
const GRADE_STYLE: Record<string, string> = { A: 'bg-green-100 text-green-800', B: 'bg-lime-100 text-lime-800', C: 'bg-amber-100 text-amber-800', D: 'bg-red-100 text-red-800' };
function SafetySection({ url, safety, onSafety }: { url: string; safety: SafetyInfo | null; onSafety: (s: SafetyInfo) => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (refresh: boolean) => {
    setBusy(true);
    try { onSafety(await apiFetch<SafetyInfo>(auth, url, { action: 'safety', refresh })); }
    catch (e) { toast({ variant: 'destructive', title: 'DOT records didn’t load', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  }, [auth, url, onSafety, toast]);
  const ran = useRef('');
  useEffect(() => { const stale = !safety?.checkedAt || Date.now() - Date.parse(safety.checkedAt) > 7 * 86400_000; if (stale && ran.current !== url) { ran.current = url; void run(false); } }, [safety, url, run]);
  const s = safety;
  const pct = (n: number | null) => n === null ? '—' : `${Math.round(n * 100)}%`;
  return <section className="space-y-2 bg-slate-50 rounded-xl p-4">
    <div className="flex justify-between items-center"><p className="font-bold">Road record (DOT, last 24 months)</p><Button size="sm" variant="outline" disabled={busy} onClick={() => run(true)}>{busy ? 'Checking…' : 'Check again'}</Button></div>
    {!s ? <p className="text-sm text-muted-foreground">{busy ? 'Reading inspections, crashes and insurance records…' : 'Not checked yet.'}</p> : <>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        {s.grade ? <span className={`px-2 py-0.5 rounded-full font-black ${GRADE_STYLE[s.grade]}`}>Safety {s.grade} · {s.score}</span> : <span className="text-muted-foreground">Too few inspections to grade</span>}
        {s.trend && <span className="text-xs px-2 py-0.5 rounded-full border">{s.trend === 'growing' ? '▲ Busier' : s.trend === 'shrinking' ? '▼ Slowing down' : '● Steady'}{s.trendPct !== null ? ` (${s.trendPct > 0 ? '+' : ''}${s.trendPct}%)` : ''}</span>}
        {s.trouble.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">{s.trouble.length} warning{s.trouble.length === 1 ? '' : 's'}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <p>Inspections: <b>{s.last12}</b> last 12 months, {s.prev12} the year before</p>
        <p>Last inspected: <b>{s.lastInspection || '—'}</b></p>
        <p>Trucks put out of service: <b>{pct(s.vehicleOosRate)}</b> <span className="text-xs text-muted-foreground">(national ~22%)</span></p>
        <p>Drivers put out of service: <b>{pct(s.driverOosRate)}</b> <span className="text-xs text-muted-foreground">(national ~6%)</span></p>
        <p>Crashes: <b>{s.crashes}</b>{s.crashes ? ` · ${s.injuries} injured · ${s.fatalities} killed` : ''}</p>
        <p>Inspected in: <b>{s.states.map(x => `${x.state} ${x.count}`).join(', ') || '—'}</b></p>
      </div>
      {s.signals.length > 0 && <ul className="text-sm list-disc pl-5 space-y-0.5">{s.signals.map((x, i) => <li key={i} className={/cancel|revok|death|fail|out of service/i.test(x) ? 'text-red-800' : ''}>{x}</li>)}</ul>}
      <p className="text-[11px] text-muted-foreground">{SAFETY_HELP} Source: FMCSA inspection, crash, insurance and revocation files{s.checkedAt ? `, checked ${new Date(s.checkedAt).toLocaleDateString()}` : ''}.</p>
    </>}
  </section>;
}

function GoogleSection({ url, places, onWeb }: { url: string; places: Detail['places']; onWeb: (w: Web) => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ info: GoogleInfo | null } | null>(null);
  const [usage, setUsage] = useState(places.usage);
  const left = usage ? usage.detailsCap - usage.details : 0;
  const get = async () => {
    setBusy(true);
    try { const r = await apiFetch<{ info: GoogleInfo | null; usage: PlacesUsage; web: Web | null }>(auth, url, { action: 'google' }); setResult({ info: r.info }); setUsage(r.usage); if (r.web) onWeb(r.web); }
    catch (e) { toast({ variant: 'destructive', title: 'Google lookup didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  if (!places.ready) return <section className="rounded-xl border p-4 text-sm text-muted-foreground"><p className="font-bold text-foreground">Google Business info</p>Not set up yet: it needs a Google Cloud API key with Places API (New) turned on (GOOGLE_CLOUD_API_KEY).</section>;
  const i = result?.info;
  return <section className="rounded-xl border-2 border-slate-200 p-4 space-y-2">
    <div className="flex justify-between items-center gap-2"><p className="font-bold">Google Business info</p><Button size="sm" variant="outline" disabled={busy || left <= 0} onClick={get}>{busy ? 'Asking Google…' : result ? 'Refresh' : 'Get Google info'}</Button></div>
    {!result ? <p className="text-xs text-muted-foreground">Live from Google when you click (1 lookup). {usage ? `${usage.details} of ${usage.detailsCap} used this month.` : ''}</p>
      : !i ? <p className="text-sm text-muted-foreground">No Google listing matched this company’s name and city (or phone).</p>
      : <div className="text-sm space-y-1">
        <p className="font-semibold">{i.name} <span className="font-normal text-muted-foreground">· {i.address}</span></p>
        {i.status && i.status !== 'OPERATIONAL' && <p className="text-red-700 font-semibold">{i.status === 'CLOSED_PERMANENTLY' ? 'Permanently closed' : i.status === 'CLOSED_TEMPORARILY' ? 'Temporarily closed' : i.status}</p>}
        <p>{i.rating !== null ? <><b>{i.rating.toFixed(1)} ★</b> from {(i.reviews || 0).toLocaleString()} reviews</> : 'No rating yet'}{i.type ? ` · ${i.type}` : ''}</p>
        {i.phone && <p>Phone: {i.phone}</p>}
        {i.website && <p>Website: <a className="underline break-all" href={i.website} target="_blank" rel="noreferrer noopener">{i.website.replace(/^https?:\/\//, '')}</a></p>}
        {i.hours.length > 0 && <details className="text-xs"><summary className="cursor-pointer">Hours</summary><ul>{i.hours.map(h => <li key={h}>{h}</li>)}</ul></details>}
        {i.mapsUrl && <a className="underline text-xs" href={i.mapsUrl} target="_blank" rel="noreferrer noopener">See reviews on Google Maps</a>}
        <p className="text-[11px] text-muted-foreground">Google doesn’t verify reviews, but removes fake content when it’s found.</p>
      </div>}
    <p className="text-[11px] text-muted-foreground">Data: <b>Google Maps</b>{usage ? ` · ${usage.details}/${usage.detailsCap} lookups this month` : ''}</p>
  </section>;
}

function WebSection({ web, busy, searchReady, braveReady, onRefresh }: { web: Web | null; busy: boolean; searchReady: boolean; braveReady: boolean; onRefresh: () => void }) {
  const chips = (socials: Record<string, string>) => <div className="flex flex-wrap gap-2">{Object.entries(socials).map(([k, u]) => <a key={k} href={u} target="_blank" rel="noreferrer noopener" className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-slate-100">{SOCIAL_NAME[k] || k}</a>)}</div>;
  return <section className="space-y-2 bg-slate-50 rounded-xl p-4">
    <div className="flex justify-between items-center"><p className="font-bold">Website & social media</p><Button size="sm" variant="outline" disabled={busy} onClick={onRefresh}>{busy ? 'Searching…' : web ? 'Search again' : 'Search now'}</Button></div>
    {busy && !web ? <p className="text-sm text-muted-foreground">Looking for their website and social profiles…</p> : !web ? null : <>
      {web.site ? <p className="text-sm"><a className="underline font-semibold break-all" href={web.site} target="_blank" rel="noreferrer noopener">{web.site.replace(/^https?:\/\//, '')}</a> <span className="text-muted-foreground">· found from {WEB_SOURCE[web.source || ''] || 'search'}{web.matchedBy.length ? `; the page shows their ${web.matchedBy.join(', ')}` : ''}</span></p>
        : <p className="text-sm text-muted-foreground">No website found. Tried {web.tried.length} address{web.tried.length === 1 ? '' : 'es'}{web.searched.length ? ` and searched ${web.searched.join(' and ')}` : ''}; none showed their phone, USDOT number, or name and city.</p>}
      {Object.keys(web.socials).length ? <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Linked from their website</p>{chips(web.socials)}</div>
        : web.site ? <p className="text-sm text-muted-foreground">Their website doesn’t link to any social profiles.</p> : null}
      {Object.keys(web.possibleSocials).length > 0 && <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Possible profiles (from search; check it’s them)</p>{chips(web.possibleSocials)}</div>}
      {web.tried.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">What was checked</summary><ul className="mt-1 space-y-0.5">{web.tried.map((t, i) => <li key={i}>{t.ok ? '✓' : '✗'} {t.url.replace(/^https?:\/\//, '')} ({t.source}){t.ok ? `: ${t.matchedBy.join(', ')}` : t.error ? `: ${t.error}` : t.matchedBy.length ? `: only ${t.matchedBy.join(', ')}` : ': not them'}</li>)}</ul></details>}
      <p className="text-xs text-muted-foreground">Checked {web.checkedAt ? new Date(web.checkedAt).toLocaleDateString() : ''}. Sources: email domain, likely addresses{searchReady ? ', Google search' : ''}{braveReady ? ', Brave search' : ''}.</p>
    </>}
  </section>;
}

export default function MoverRegistryPage() { return <EmployeeLayout isAdmin><Registry /></EmployeeLayout>; }
