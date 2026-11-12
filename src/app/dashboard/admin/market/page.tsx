'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { REGISTRY_AREAS } from '@/lib/registry';

type Tab = 'closures' | 'changes' | 'expansion' | 'buy' | 'prices' | 'settings';
type Ev = { id: string; type: string; dot: string; state: string; county: string; zip: string; name: string; dba: string; city: string; phone: string; email: string; site: string; officer: string; mc: string; units: number; drivers: number; years: number; hhgAuth: boolean; from?: number; to?: number; reason?: string; effectiveDate?: string; confidence?: string; day: string; stage?: string };

const nice = (s: string) => (s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());
const phone = (p: string) => (p?.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const money = (n: number | null | undefined) => (typeof n === 'number' ? `$${Math.round(n).toLocaleString()}` : '—');

function Market() {
  const [tab, setTab] = useState<Tab>('closures');
  const [scope, setScope] = useState('watched');
  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Market radar</h1>
      <p className="text-muted-foreground">What’s changing among moving companies in your areas, from federal records updated daily: who closed (and how to win their customers), who’s new, where to expand, who to buy, and what everyone charges.</p>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      {([['closures', 'Closed companies'], ['changes', 'New & changing'], ['expansion', 'Where to expand'], ['buy', 'Companies to buy'], ['prices', 'Price index'], ['settings', 'Settings']] as [Tab, string][]).map(([t, l]) => <Button key={t} variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>{l}</Button>)}
      {tab !== 'settings' && <select aria-label="Area" className="h-10 border rounded-md px-2 bg-white text-sm" value={scope} onChange={e => setScope(e.target.value)}>
        <option value="watched">My watched areas</option>{tab === 'expansion' && <option value="national">Whole country</option>}{REGISTRY_AREAS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>}
    </div>
    {tab === 'closures' && <Closures scope={scope} />}
    {tab === 'changes' && <Changes scope={scope} />}
    {tab === 'expansion' && <Expansion scope={scope} />}
    {tab === 'buy' && <Buy scope={scope} />}
    {tab === 'prices' && <Prices scope={scope} />}
    {tab === 'settings' && <Settings />}
  </div>;
}

function useView<T>(view: string, scope: string, extra = '') {
  const auth = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { setError(''); return apiFetch<T>(auth, `/api/admin/market?view=${view}&scope=${scope}${extra}`).then(setData).catch(e => setError(e instanceof Error ? e.message : 'Could not load.')); }, [auth, view, scope, extra]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return { data, error, reload: load };
}

// ---- Closed companies + takeover playbook -----------------------------------------

function Closures({ scope }: { scope: string }) {
  const [days, setDays] = useState(365);
  const { data, error, reload } = useView<{ events: Ev[]; stages: Record<string, string> }>('closures', scope, `&days=${days}`);
  const [open, setOpen] = useState<string | null>(null);
  const [stage, setStage] = useState('');
  const shown = (data?.events || []).filter(e => !stage || e.stage === stage);
  return <div className="space-y-4">
    <Card className="bg-slate-900 text-white"><CardContent className="p-5 space-y-2">
      <p className="font-black text-lg">How to win a closed company’s customers</p>
      <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
        <li><b className="text-white">Call the owner in the first week.</b> Offer to take care of their customers and to buy what still brings in business: their phone number (calls keep coming for years), website domain, customer referrals, storage contracts and trucks.</li>
        <li><b className="text-white">Hire their crew.</b> Their movers and drivers know the customers and the area, and need work now.</li>
        <li><b className="text-white">Own their area for 60 days.</b> Ads and neighborhood posts in their ZIP codes, bidding on their name as a keyword, and a landing page for stranded customers (wontstopmoving.com/mover-closed).</li>
        <li><b className="text-white">Tell their referral sources.</b> Local realtors, apartment managers and storage facilities just lost a mover.</li>
      </ol>
      <p className="text-xs text-slate-400">Customer lists only with the owner’s permission, and contacted under consent and anti-spam rules. Never imply you are, or are affiliated with, the closed company.</p>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2 items-center">
      <select aria-label="Time range" className="h-9 border rounded-md px-2 bg-white text-sm" value={days} onChange={e => setDays(Number(e.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option><option value={540}>Last 18 months</option></select>
      <select aria-label="Stage" className="h-9 border rounded-md px-2 bg-white text-sm" value={stage} onChange={e => setStage(e.target.value)}><option value="">All stages</option>{Object.entries(data?.stages || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <p className="text-sm text-muted-foreground">{data ? `${shown.length} closed moving companies` : 'Loading…'}</p>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="space-y-2">
      {shown.map(e => <Card key={e.id} className="bg-white"><CardContent className="p-4 flex flex-wrap justify-between gap-3">
        <div className="space-y-1">
          <p className="font-bold text-primary">{nice(e.dba || e.name)} <Badge variant="outline" className="ml-1 text-[10px]">{data?.stages[e.stage || 'new']}</Badge></p>
          <p className="text-sm text-muted-foreground">{nice(e.city)}, {e.state} · {plural(e.units, 'truck')} · {plural(e.drivers, 'driver')} · {plural(e.years, 'year')}{e.officer ? ` · owner: ${nice(e.officer)}` : ''}</p>
          <p className="text-sm"><span className="font-semibold">{e.reason || 'No longer active'}</span>{e.effectiveDate ? ` on ${e.effectiveDate}` : ''}{e.confidence === 'unclear' ? ' (unconfirmed)' : ''}</p>
        </div>
        <div className="flex gap-2 items-start">{e.phone && <Button asChild size="sm" variant="outline"><a href={`tel:${e.phone}`}>Call {phone(e.phone)}</a></Button>}<Button size="sm" onClick={() => setOpen(e.dot)}>Takeover plan</Button></div>
      </CardContent></Card>)}
      {data && !shown.length && <p className="text-muted-foreground">No closures here yet. The radar checks every state daily; the first full history loads within a day of going live.</p>}
    </div>
    {open && <Takeover dot={open} onClose={() => { setOpen(null); void reload(); }} />}
  </div>;
}

type TakeoverData = {
  event: Ev; zips: string[]; stages: Record<string, string>; assets: Record<string, string>;
  results: { before90: number; after: number; bookedAfter: number; fromCampaign: number; daysSince: number; perMonthBefore: number; perMonthAfter: number };
  takeover: { stage: string; notes: string; assets: Record<string, boolean>; scripts: null | { ownerCall: string; ownerEmail: string; crewText: string; adHeadlines: string[]; adDescriptions: string[]; keywords: string[]; communityPost: string; partnerEmail: string }; scriptsAt: string | null; log: { at: string; by: string; text: string }[] };
  links: { safer: string; google: string; site: string | null; landing: string };
};

function Takeover({ dot, onClose }: { dot: string; onClose: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [d, setD] = useState<TakeoverData | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => apiFetch<TakeoverData>(auth, `/api/admin/market?view=takeover&dot=${dot}`).then(x => { setD(x); setNotes(x.takeover.notes); }).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load', description: e instanceof Error ? e.message : '' })), [auth, dot, toast]);
  useEffect(() => { void load(); }, [load]);
  const post = async (body: Record<string, unknown>, label: string, ok?: string) => {
    setBusy(label);
    try { await apiFetch(auth, '/api/admin/market', body); if (ok) toast({ title: ok }); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(''); }
  };
  const copy = (t: string) => { void navigator.clipboard.writeText(t); toast({ title: 'Copied' }); };
  const e = d?.event, s = d?.takeover.scripts;
  const Block = ({ title, text }: { title: string; text: string }) => <div className="space-y-1"><div className="flex justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p><button className="text-xs underline" onClick={() => copy(text)}>Copy</button></div><p className="text-sm whitespace-pre-wrap bg-white border rounded-lg p-3">{text}</p></div>;

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Takeover plan">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative w-full max-w-2xl h-full bg-gray-50 overflow-y-auto p-6 space-y-6 shadow-2xl">
      <div className="flex justify-between gap-3"><div>{e ? <><h2 className="text-2xl font-black text-primary">{nice(e.dba || e.name)}</h2><p className="text-sm text-muted-foreground">{e.reason}{e.effectiveDate ? ` · ${e.effectiveDate}` : ''} · USDOT {e.dot}{e.mc ? ` · ${e.mc}` : ''}</p></> : <p>Loading…</p>}</div><Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button></div>
      {d && e && <>
        <section className="bg-white rounded-xl p-4 grid sm:grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs font-bold uppercase text-muted-foreground">Owner / officer</p><p className="font-semibold">{nice(e.officer) || 'Not on file'}</p></div>
          <div><p className="text-xs font-bold uppercase text-muted-foreground">Contact</p>{e.phone ? <a className="underline" href={`tel:${e.phone}`}>{phone(e.phone)}</a> : '—'}{e.email && <><br /><a className="underline break-all" href={`mailto:${e.email}`}>{e.email}</a></>}</div>
          <div><p className="text-xs font-bold uppercase text-muted-foreground">They had</p><p>{plural(e.units, 'truck')} · {plural(e.drivers, 'driver')} · {plural(e.years, 'year')}{e.hhgAuth ? ' · interstate authority' : ''}</p></div>
          <div><p className="text-xs font-bold uppercase text-muted-foreground">Check</p><a className="underline mr-2" href={d.links.safer} target="_blank" rel="noreferrer noopener">FMCSA</a><a className="underline mr-2" href={d.links.google} target="_blank" rel="noreferrer noopener">Google</a>{d.links.site && <a className="underline" href={d.links.site} target="_blank" rel="noreferrer noopener">Their website</a>}</div>
        </section>

        <section className="bg-white rounded-xl p-4 space-y-3">
          <p className="font-bold">Progress</p>
          <select aria-label="Stage" className="h-10 border rounded-md px-2 bg-white text-sm w-full" value={d.takeover.stage} disabled={!!busy} onChange={ev => void post({ action: 'takeover-update', dot, stage: ev.target.value }, 'stage', 'Stage updated')}>{Object.entries(d.stages).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <div className="grid sm:grid-cols-2 gap-1">{Object.entries(d.assets).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!!busy} checked={!!d.takeover.assets[k]} onChange={ev => void post({ action: 'takeover-update', dot, assets: { [k]: ev.target.checked } }, 'asset')} />{l}</label>)}</div>
          <Textarea rows={3} placeholder="Notes: who you spoke with, what they want for the phone number and domain, next steps…" value={notes} onChange={ev => setNotes(ev.target.value)} />
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void post({ action: 'takeover-update', dot, notes }, 'notes', 'Notes saved')}>Save notes</Button>
          {d.takeover.log.length > 0 && <ul className="text-xs text-muted-foreground space-y-1">{[...d.takeover.log].reverse().slice(0, 10).map((l, i) => <li key={i}>{new Date(l.at).toLocaleDateString()} · {l.by}: {l.text}</li>)}</ul>}
        </section>

        <section className="bg-white rounded-xl p-4 space-y-2">
          <p className="font-bold">Are you winning their customers?</p>
          <p className="text-sm text-muted-foreground">Quote requests from the {d.zips.length} ZIP codes within 15 miles of them.</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-black">{d.results.perMonthBefore}</p><p className="text-xs text-muted-foreground">per month before they closed</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-black text-accent">{d.results.perMonthAfter}</p><p className="text-xs text-muted-foreground">per month since ({d.results.after} total)</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-black text-green-700">{d.results.bookedAfter}</p><p className="text-xs text-muted-foreground">booked since · {d.results.fromCampaign} from your campaign</p></div>
          </div>
        </section>

        <section className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center"><p className="font-bold">Target these ZIP codes</p><button className="text-xs underline" onClick={() => copy(d.zips.join(', '))}>Copy all</button></div>
          <p className="text-sm break-words text-muted-foreground">{d.zips.join(', ') || 'No location on file.'}</p>
          <p className="text-xs text-muted-foreground">Paste into Google Ads, Meta and Nextdoor location targeting. Send ads to <a className="underline" href={d.links.landing} target="_blank" rel="noreferrer noopener">wontstopmoving.com/mover-closed</a>, which tracks results here.</p>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center"><p className="font-bold">Scripts and ads written for this company</p><Button size="sm" disabled={!!busy} onClick={() => void post({ action: 'takeover-scripts', dot }, 'ai', 'Scripts written')}>{busy === 'ai' ? 'Writing…' : s ? 'Rewrite' : 'Write with AI'}</Button></div>
          {s ? <>
            <Block title="Call the owner" text={s.ownerCall} />
            <Block title="Email the owner" text={s.ownerEmail} />
            <Block title="Text their crew" text={s.crewText} />
            <Block title="Ad headlines (30 characters)" text={s.adHeadlines.join('\n')} />
            <Block title="Ad descriptions (90 characters)" text={s.adDescriptions.join('\n')} />
            <Block title="Keywords" text={s.keywords.join('\n')} />
            <Block title="Neighborhood post (Nextdoor / Facebook)" text={s.communityPost} />
            <Block title="Email realtors, apartments and storage facilities" text={s.partnerEmail} />
            <p className="text-xs text-muted-foreground">Bidding on a competitor’s name as a keyword is allowed; using it in ad text generally isn’t. Review before sending.</p>
          </> : <p className="text-sm text-muted-foreground">AI writes a call script, emails, crew text, ads, keywords and community posts tailored to this company and its area.</p>}
        </section>
      </>}
    </div>
  </div>;
}

// ---- New & changing -------------------------------------------------------------------

function Changes({ scope }: { scope: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const { data, error } = useView<{ events: Ev[] }>('changes', scope, `&days=${days}`);
  const [type, setType] = useState('new');
  const shown = (data?.events || []).filter(e => e.type === type);
  const track = async (e: Ev) => {
    try { const r = await apiFetch<{ added: number }>(auth, '/api/admin/market', { action: 'track', dot: e.dot, state: e.state }); toast({ title: r.added ? `${nice(e.dba || e.name)} added to competitors` : 'Already tracked' }); }
    catch (err) { toast({ variant: 'destructive', title: 'That didn’t work', description: err instanceof Error ? err.message : '' }); }
  };
  const recruit = async (list: Ev[]) => {
    try { const r = await apiFetch<{ added: number }>(auth, '/api/admin/agents', { action: 'prospect-add-many', movers: list.map(e => ({ dot: e.dot, state: e.state })), source: 'radar-new', note: 'New registration spotted by the market radar.' }); toast({ title: `Added ${r.added} to agent recruiting` }); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 items-center">
      {[['new', 'New companies'], ['grew', 'Grew'], ['shrank', 'Shrank']].map(([t, l]) => <Button key={t} size="sm" variant={type === t ? 'default' : 'outline'} onClick={() => setType(t)}>{l} ({(data?.events || []).filter(e => e.type === t).length})</Button>)}
      <select aria-label="Time range" className="h-9 border rounded-md px-2 bg-white text-sm" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>
      {type === 'new' && shown.length > 0 && <Button size="sm" variant="outline" onClick={() => void recruit(shown.slice(0, 100))}>Add all to agent recruiting</Button>}
    </div>
    <p className="text-sm text-muted-foreground">{type === 'new' ? 'Newly registered movers: reach them before a van line does.' : type === 'grew' ? 'Competitors adding trucks: see what they’re doing right.' : 'Shrinking fleets: watch for closures, crews looking for work, or a company to buy.'} Changes are detected from the second day the radar runs.</p>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading…</p> : !shown.length ? <p className="text-muted-foreground">Nothing yet in this range.</p> :
      <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b">{['Company', 'Trucks', 'Detected', 'Contact', ''].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{shown.map(e => <tr key={e.id} className="border-b last:border-0"><td className="p-3"><p className="font-bold">{nice(e.dba || e.name)}</p><p className="text-xs text-muted-foreground">{nice(e.city)}, {e.state}{e.officer ? ` · ${nice(e.officer)}` : ''}</p></td>
          <td className="p-3">{e.type === 'new' ? e.units : `${e.from} → ${e.to}`}</td><td className="p-3">{e.day}</td>
          <td className="p-3 text-xs">{e.phone && <a className="underline" href={`tel:${e.phone}`}>{phone(e.phone)}</a>}{e.email && <><br />{e.email}</>}</td>
          <td className="p-3 flex gap-2">{e.type === 'new' && <Button size="sm" variant="outline" onClick={() => void recruit([e])}>Recruit</Button>}<Button size="sm" variant="outline" onClick={() => void track(e)}>Track</Button></td></tr>)}</tbody></table></CardContent></Card>}
  </div>;
}

// ---- Where to expand ---------------------------------------------------------------------

type County = { fips: string; name: string; state: string; population: number; movers: number; trucks: number; quotes: number; bookings: number; per10k: number; trucksPer10k: number; score: number };
function Expansion({ scope }: { scope: string }) {
  const { data, error } = useView<{ counties: County[] }>('expansion', scope);
  const [min, setMin] = useState(100000);
  const shown = (data?.counties || []).filter(c => c.population >= min).slice(0, 150);
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Counties ranked by opportunity: lots of people per moving company (less competition), market size, and your own quote requests and bookings there (last 180 days). Population: U.S. Census 2024 estimates. Movers: the federal registry.</p>
    <label className="text-sm">Minimum population <select className="ml-2 h-9 border rounded-md px-2 bg-white" value={min} onChange={e => setMin(Number(e.target.value))}>{[20000, 50000, 100000, 250000, 500000, 1000000].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading…</p> : <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground border-b">{['#', 'County', 'Population', 'Movers', 'Movers per 10k', 'Trucks per 10k', 'Your quotes', 'Bookings', 'Score'].map(h => <th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>{shown.map((c, i) => <tr key={c.fips} className="border-b last:border-0"><td className="p-3 text-muted-foreground">{i + 1}</td><td className="p-3 font-semibold">{c.name}, {c.state}</td><td className="p-3">{c.population.toLocaleString()}</td><td className="p-3">{c.movers}</td>
        <td className={`p-3 ${c.per10k < 0.5 ? 'text-green-700 font-semibold' : ''}`}>{c.per10k}</td><td className="p-3">{c.trucksPer10k}</td><td className="p-3">{c.quotes}</td><td className="p-3">{c.bookings}</td><td className="p-3 font-black text-accent">{c.score}</td></tr>)}</tbody>
    </table></CardContent></Card>}
    <p className="text-xs text-muted-foreground">Green: under 0.5 movers per 10,000 people, an under-served market. A county with your quote requests but few movers is the best next market: recruit agents there first.</p>
  </div>;
}

// ---- Companies to buy -------------------------------------------------------------------------

type Target = Ev & { score: number; staleSince: string; drivers: number; added: string };
function Buy({ scope }: { scope: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const { data, error } = useView<{ targets: Target[] }>('acquisitions', scope);
  const track = async (t: Target) => {
    try { await apiFetch(auth, '/api/admin/market', { action: 'track', dot: t.dot, state: t.state }); toast({ title: `${nice(t.dba || t.name)} added to competitors` }); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Small, long-running movers whose federal filings have gone stale: often an owner close to retiring, with a name, customers and referral sources worth buying. Scored on years in business, how long since their last federal update, fleet size and interstate authority. A respectful “have you thought about what’s next for the business?” call is how most deals start.</p>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading…</p> : <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground border-b">{['Score', 'Company', 'Years', 'Trucks', 'Last federal update', 'Owner & contact', ''].map(h => <th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>{data.targets.map(t => <tr key={t.dot} className="border-b last:border-0"><td className="p-3 font-black text-accent">{t.score}</td><td className="p-3"><p className="font-bold">{nice(t.dba || t.name)}</p><p className="text-xs text-muted-foreground">{nice(t.city)}, {t.state} · USDOT {t.dot}{t.hhgAuth ? ' · interstate' : ''}</p></td>
        <td className="p-3">{t.years}</td><td className="p-3">{t.units}</td><td className="p-3">{t.staleSince || '—'}</td>
        <td className="p-3 text-xs">{nice(t.officer)}{t.phone && <><br /><a className="underline" href={`tel:${t.phone}`}>{phone(t.phone)}</a></>}{t.email && <><br />{t.email}</>}</td>
        <td className="p-3"><Button size="sm" variant="outline" onClick={() => void track(t)}>Track</Button></td></tr>)}
        {!data.targets.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No strong candidates in this area.</td></tr>}</tbody>
    </table></CardContent></Card>}
  </div>;
}

// ---- Price index ----------------------------------------------------------------------------

type Q = { low: number; median: number; high: number; count: number } | null;
type PriceData = { checked: number; published: number; hourly: { twoMovers: Q; threeMovers: Q; minimumHours: Q }; bySize: { size: string; ours: number | null; flat: Q; hourlyEstimate: Q; crew: number; hours: number }[]; companies: { id: string; name: string; city: string; state: string; url: string; prices: { published: boolean; twoMovers: number | null; threeMovers: number | null; minimumHours: number | null; notes: string } | null; error: string | null; fetchedAt: string | null }[] };
const SIZE: Record<string, string> = { studio: 'Studio', oneBedroom: '1 bedroom', twoBedroom: '2 bedrooms', threeBedroom: '3 bedrooms', fourBedroom: '4+ bedrooms' };
function Prices({ scope }: { scope: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const { data, error, reload } = useView<PriceData>('prices', scope);
  const [busy, setBusy] = useState(false);
  const range = (q: Q) => (q ? `${money(q.low)}–${money(q.high)} (median ${money(q.median)}, ${q.count})` : '—');
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-2 items-center">
      <p className="text-sm text-muted-foreground">{data ? `${data.published} of ${data.checked} websites read publish prices.` : ''} AI reads competitors’ websites monthly (tracked competitors first, then the biggest movers in your areas), a few each hour.</p>
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const r = await apiFetch<{ priced: number }>(auth, '/api/admin/market', { action: 'price-refresh' }); toast({ title: `Read ${r.priced} more websites` }); await reload(); } catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); } finally { setBusy(false); } }}>{busy ? 'Reading websites…' : 'Read more now'}</Button>
    </div>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="bg-white"><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">2 movers + truck, hourly</p><p className="font-semibold mt-1">{range(data.hourly.twoMovers)}</p></CardContent></Card>
        <Card className="bg-white"><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">3 movers + truck, hourly</p><p className="font-semibold mt-1">{range(data.hourly.threeMovers)}</p></CardContent></Card>
        <Card className="bg-white"><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Minimum hours</p><p className="font-semibold mt-1">{data.hourly.minimumHours ? `${data.hourly.minimumHours.low}–${data.hourly.minimumHours.high} (median ${data.hourly.minimumHours.median})` : '—'}</p></CardContent></Card>
      </div>
      <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground border-b">{['Home size', 'Our price', 'Their flat prices', 'Their hourly, as a total*', 'Where we sit'].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.bySize.map(r => { const ref = r.flat?.median ?? r.hourlyEstimate?.median; const pct = ref && r.ours ? Math.round(((r.ours - ref) / ref) * 100) : null; return <tr key={r.size} className="border-b last:border-0">
          <td className="p-3 font-semibold">{SIZE[r.size]}</td><td className="p-3">{money(r.ours)}</td><td className="p-3">{range(r.flat)}</td><td className="p-3">{range(r.hourlyEstimate)}<br /><span className="text-xs text-muted-foreground">{r.crew} movers × {r.hours} hours</span></td>
          <td className={`p-3 font-semibold ${pct === null ? '' : pct > 15 ? 'text-red-700' : pct < -15 ? 'text-green-700' : ''}`}>{pct === null ? 'Not enough data' : pct > 0 ? `${pct}% above market` : pct < 0 ? `${-pct}% below market` : 'At market'}</td></tr>; })}</tbody>
      </table></CardContent></Card>
      <p className="text-xs text-muted-foreground">*Hourly totals assume a typical local job (crew × hours shown, at least their minimum, plus any travel fee). Our prices are flat, including the truck.</p>
      <details className="bg-white rounded-xl p-4"><summary className="cursor-pointer font-bold text-sm">Every website read ({data.companies.length})</summary>
        <ul className="mt-3 space-y-2 text-sm">{data.companies.map(c => <li key={c.id} className="border-b last:border-0 pb-2"><a className="font-semibold underline" href={c.url} target="_blank" rel="noreferrer noopener">{c.name}</a> <span className="text-muted-foreground">{c.city}{c.state && !c.city.includes(c.state) ? `, ${c.state}` : ''}</span><br />
          <span className="text-xs">{c.error ? `Couldn’t read: ${c.error}` : c.prices?.published ? `${c.prices.twoMovers ? `2 movers ${money(c.prices.twoMovers)}/hr · ` : ''}${c.prices.threeMovers ? `3 movers ${money(c.prices.threeMovers)}/hr · ` : ''}${c.prices.notes}` : 'No prices published'}</span></li>)}</ul>
      </details>
    </>}
  </div>;
}

// ---- Settings ---------------------------------------------------------------------------------

function Settings() {
  const auth = useAuth();
  const { toast } = useToast();
  const [d, setD] = useState<{ settings: { regions: string[]; states: string[]; email: string }; routing: { autoAssign: boolean; maxMiles: number }; regions: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch(auth, '/api/admin/market?view=settings').then(setD).catch(() => {}); }, [auth]);
  if (!d) return <p>Loading…</p>;
  const save = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await apiFetch(auth, '/api/admin/market', { action: 'settings', ...body }); toast({ title: ok }); setD(await apiFetch(auth, '/api/admin/market?view=settings')); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  return <div className="grid md:grid-cols-2 gap-4">
    <Card className="bg-white"><CardContent className="p-5 space-y-3">
      <p className="font-bold">Watched areas</p>
      <p className="text-sm text-muted-foreground">The radar, closures, buy list and price index focus here.</p>
      {Object.entries(d.regions).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={d.settings.regions.includes(k)} onChange={e => void save({ regions: e.target.checked ? [...d.settings.regions, k] : d.settings.regions.filter(r => r !== k) }, 'Areas saved')} />{l}</label>)}
      <div className="flex flex-wrap gap-1">{d.settings.states.map(s => <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => void save({ states: d.settings.states.filter(x => x !== s) }, `${s} removed`)}>{s} ✕</Badge>)}</div>
      <select aria-label="Add a whole state" className="h-9 border rounded-md px-2 bg-white text-sm" value="" onChange={e => e.target.value && void save({ states: [...d.settings.states, e.target.value] }, `${e.target.value} added`)}><option value="">Add a whole state…</option>{REGISTRY_AREAS.filter(s => !d.settings.states.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}</select>
    </CardContent></Card>
    <Card className="bg-white"><CardContent className="p-5 space-y-3">
      <p className="font-bold">Daily radar email</p>
      <p className="text-sm text-muted-foreground">Sent each morning (after 7am Pacific) when something changed: closures, new movers, fleet changes, competitors you passed, and partner compliance alerts.</p>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const v = new FormData(e.currentTarget).get('email'); void save({ email: String(v || '') }, 'Email saved'); }}><Input name="email" type="email" defaultValue={d.settings.email} /><Button type="submit" variant="outline" disabled={busy}>Save</Button></form>
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => { try { const r = await apiFetch<{ sent: boolean }>(auth, '/api/admin/market', { action: 'radar-test' }); toast({ title: r.sent ? 'Today’s radar sent' : 'Already sent today' }); } catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); } }}>Send today’s radar now</Button>
    </CardContent></Card>
    <Card className="bg-white md:col-span-2"><CardContent className="p-5 space-y-3">
      <p className="font-bold">Automatic job routing</p>
      <p className="text-sm text-muted-foreground">When a booking is paid, we find the closest approved provider (free that day) or agent (serving that state) and a backup. With auto-assign on, the closest is assigned and emailed right away; the choice is logged in the job’s history and you can change it anytime.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={d.routing.autoAssign} onChange={e => void save({ autoAssign: e.target.checked }, e.target.checked ? 'Auto-assign on' : 'Auto-assign off: suggestions only')} />Assign the closest automatically</label>
      <label className="text-sm">Only within <select className="ml-1 h-9 border rounded-md px-2 bg-white" value={d.routing.maxMiles} disabled={busy} onChange={e => void save({ maxMiles: Number(e.target.value) }, 'Distance saved')}>{[25, 50, 75, 100, 150].map(n => <option key={n} value={n}>{n} miles</option>)}</select> of the pickup</label>
    </CardContent></Card>
  </div>;
}

export default function MarketRadarPage() { return <EmployeeLayout isAdmin><Market /></EmployeeLayout>; }
