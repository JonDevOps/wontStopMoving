'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { compareToUs, METRICS, passGaps, SOCIAL_LABEL, sortActions, type ActionItem, type Metrics, type Scoreboard, type Tier } from '@/lib/competitors';

type Competitor = {
  id: string; name: string; website: string; location: string; tier: Tier; status: 'tracking' | 'passed';
  metrics: Metrics; socials: Record<string, string>; notes: Record<string, string>; actions: ActionItem[]; score: Scoreboard;
  intel: { summary: string; services: string[]; pricing: string; promotions: string; sellingPoints: string[]; sourceUrl: string | null; websiteError: string | null } | null;
  analysis: { strengths: string[]; weaknesses: string[]; threat: 'high' | 'medium' | 'low' } | null;
  passedAt: string | null; passedHow: string | null; analyzedAt: string | null;
};
type Data = { us: { metrics: Metrics; auto: Metrics; manual: Metrics; socials: Record<string, string>; hasAuthority: boolean }; competitors: Competitor[]; progress?: Progress };
type View = 'challenger' | 'legend' | 'actions' | 'social' | 'us' | 'progress';
type Progress = { history: { day: string; metrics: Metrics; passed: number; actionsDone: number }[]; passes: { id: string; name: string; tier: Tier; at: string; how: string | null }[]; actions: { competitor: string; text: string; area: string; impact: string; at: string }[] };

const fmt = (key: keyof Metrics, v: number | undefined) => {
  if (typeof v !== 'number') return '—';
  const f = METRICS.find(m => m.key === key)?.format;
  return f === 'money' ? `$${Math.round(v).toLocaleString()}` : f === 'rating' ? `${v.toFixed(1)}★` : f === 'percent' ? `${v}%` : v.toLocaleString();
};
const THREAT: Record<string, string> = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-green-100 text-green-800' };
const NOTES: { key: string; label: string; placeholder: string }[] = [
  { key: 'pricing', label: 'Prices', placeholder: 'Hourly rates, minimums, flat prices, fees…' },
  { key: 'promotions', label: 'Promotions', placeholder: 'Discounts, offers, guarantees…' },
  { key: 'ads', label: 'Ads', placeholder: 'Where they advertise, what the ads say (Google, Facebook, Yelp, Thumbtack…)' },
  { key: 'social', label: 'Social media', placeholder: 'Platforms, what they post, how often, what gets likes…' },
  { key: 'other', label: 'Anything else', placeholder: 'Reviews themes, service area, fleet, hiring, partnerships…' },
];

function Competitors() {
  const auth = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<View>('challenger');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [showPassed, setShowPassed] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => apiFetch<Data>(auth, '/api/admin/competitors?history=1').then(setData).catch(e => setNotice(e instanceof Error ? e.message : 'Could not load competitors.')), [auth]);
  useEffect(() => { void load(); }, [load]);

  const post = useCallback(async (body: Record<string, unknown>, label = 'save') => {
    setBusy(label); setNotice('');
    try { const r = await apiFetch<any>(auth, '/api/admin/competitors', body); await load(); return r; }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); return null; }
    finally { setBusy(''); }
  }, [auth, load]);

  const all = data?.competitors || [];
  const tierList = (t: Tier) => all.filter(c => c.tier === t);
  const challengers = tierList('challenger'), legends = tierList('legend');
  const phase2 = challengers.length > 0 && challengers.every(c => c.status === 'passed');
  const nextUp = (list: Competitor[]) => list.filter(c => c.status === 'tracking').sort((a, b) => (b.score.known > 0 ? 1 : 0) - (a.score.known > 0 ? 1 : 0) || a.score.gap - b.score.gap || a.score.behind - b.score.behind)[0];
  const target = nextUp(phase2 ? legends : challengers);
  const openActions = useMemo(() => sortActions(all.filter(c => c.status === 'tracking').flatMap(c => c.actions.filter(a => !a.done).map(a => ({ ...a, competitor: c })))), [all]);

  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Competitor tracker</h1>
      <p className="text-muted-foreground">Study each competitor, copy what works, then pass them on the numbers. Pass your main list first, then take on the legends.</p>
      <details className="text-sm bg-white border rounded-lg p-3"><summary className="cursor-pointer font-semibold">How “passing” works</summary><p className="mt-2 text-muted-foreground">You pass a competitor when you lead them on <b>every</b> number you both have (at least two): revenue, Google reviews and rating, followers, posts, likes, customers, repeat rate, trucks, drivers and years. Each competitor shows exactly which numbers they still lead on and by how much. Numbers either side hasn’t entered don’t count, so fill in Our numbers and theirs. “Check for passes” applies this; you can also mark a pass by hand.</p></details>
    </div>

    <div className="grid md:grid-cols-3 gap-4">
      <Card className={`bg-white ${!phase2 ? 'ring-2 ring-accent' : ''}`}><CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phase 1 · Main list</p>
        <p className="text-3xl font-black mt-1">{challengers.filter(c => c.status === 'passed').length}<span className="text-lg text-muted-foreground"> / {challengers.length} passed</span></p>
        <Progress value={challengers.length ? (challengers.filter(c => c.status === 'passed').length / challengers.length) * 100 : 0} />
      </CardContent></Card>
      <Card className={`bg-white ${phase2 ? 'ring-2 ring-accent' : ''}`}><CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phase 2 · Legends {phase2 ? '' : '(after the main list)'}</p>
        <p className="text-3xl font-black mt-1">{legends.filter(c => c.status === 'passed').length}<span className="text-lg text-muted-foreground"> / {legends.length} passed</span></p>
        <Progress value={legends.length ? (legends.filter(c => c.status === 'passed').length / legends.length) * 100 : 0} />
      </CardContent></Card>
      <Card className="bg-slate-900 text-white"><CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next up</p>
        {target ? <>
          <p className="text-2xl font-black mt-1">{target.name}</p>
          <p className="text-sm text-slate-300">{target.score.known ? `Behind on ${target.score.behind} of ${target.score.known} known numbers` : 'Add their numbers to measure the gap'}</p>
          <Button size="sm" className="mt-3" onClick={() => { setView(target.tier); setOpenId(target.id); }}>Open</Button>
        </> : <p className="text-sm text-slate-300 mt-2">{all.length ? 'Everyone on this list is passed. Add the next list.' : 'Add competitors to start.'}</p>}
      </CardContent></Card>
    </div>

    <div className="flex flex-wrap gap-2">
      {([['challenger', `Main list (${challengers.length})`], ['legend', `Legends (${legends.length})`], ['actions', `Action board (${openActions.length})`], ['social', 'Social media'], ['us', 'Our numbers'], ['progress', 'Progress']] as [View, string][]).map(([v, label]) =>
        <Button key={v} variant={view === v ? 'default' : 'outline'} onClick={() => setView(v)}>{label}</Button>)}
      <Button asChild variant="ghost"><a href="/dashboard/admin/movers">Find competitors in the registry</a></Button>
      <Button variant="ghost" disabled={!!busy} onClick={async () => { const r = await post({ action: 'refresh-standings' }, 'refresh'); if (r) setNotice(r.newlyPassed.length ? `Passed: ${r.newlyPassed.join(', ')}` : 'No new passes yet. Keep going.'); }}>Check for passes</Button>
    </div>
    {notice && <p role="status" className="text-sm font-medium bg-white border rounded-lg p-3">{notice}</p>}

    {!data ? <p>Loading…</p> : view === 'progress' ? <ProgressView progress={data.progress} us={data.us.metrics} />
      : view === 'social' ? <SocialView competitors={all.filter(c => c.status === 'tracking')} us={data.us} busy={!!busy} post={post} setNotice={setNotice} onOpen={c => { setView(c.tier); setOpenId(c.id); }} />
      : view === 'us' ? <OurNumbers us={data.us} busy={!!busy} onSave={(m, extra) => post({ action: 'us', metrics: m, ...extra }).then(r => r && setNotice('Our numbers saved.'))} />
      : view === 'actions' ? <ActionBoard items={openActions} onToggle={(cid, aid) => post({ action: 'toggle-action', id: cid, actionId: aid, done: true })} onOpen={c => { setView(c.tier); setOpenId(c.id); }} />
      : <>
        <AddCompetitors tier={view} busy={!!busy} post={post} setNotice={setNotice} />
        <div className="flex flex-wrap items-center gap-3">
          <Input className="max-w-xs bg-white" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showPassed} onChange={e => setShowPassed(e.target.checked)} /> Show passed</label>
        </div>
        <div className="space-y-3">
          {tierList(view).filter(c => (showPassed || c.status === 'tracking') && c.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => Number(a.status === 'passed') - Number(b.status === 'passed') || a.score.gap - b.score.gap)
            .map(c => <CompetitorRow key={c.id} c={c} us={data.us.metrics} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} post={post} busy={busy} setBusy={setBusy} setNotice={setNotice} reload={load} />)}
          {tierList(view).length === 0 && <p className="text-muted-foreground">No companies on this list yet. Add them above, or paste your whole list.</p>}
        </div>
      </>}
  </div>;
}

function Progress({ value }: { value: number }) {
  return <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function AddCompetitors({ tier, busy, post, setNotice }: { tier: Tier; busy: boolean; post: (b: Record<string, unknown>, l?: string) => Promise<any>; setNotice: (s: string) => void }) {
  const [mode, setMode] = useState<'one' | 'many' | null>(null);
  const [form, setForm] = useState({ name: '', website: '', location: '' });
  const [text, setText] = useState('');
  return <Card className="bg-white"><CardContent className="p-4 space-y-3">
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={mode === 'one' ? 'default' : 'outline'} onClick={() => setMode(mode === 'one' ? null : 'one')}>Add a company</Button>
      <Button size="sm" variant={mode === 'many' ? 'default' : 'outline'} onClick={() => setMode(mode === 'many' ? null : 'many')}>Paste a list</Button>
    </div>
    {mode === 'one' && <form className="grid sm:grid-cols-4 gap-2" onSubmit={async e => { e.preventDefault(); if (await post({ action: 'add', tier, ...form })) { setForm({ name: '', website: '', location: '' }); setNotice(`${form.name} added.`); } }}>
      <Input required placeholder="Company name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <Input placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
      <Input placeholder="City, state" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
      <Button type="submit" disabled={busy}>Add</Button>
    </form>}
    {mode === 'many' && <form className="space-y-2" onSubmit={async e => { e.preventDefault(); const r = await post({ action: 'import', tier, text }, 'import'); if (r) { setText(''); setNotice(`Added ${r.added}${r.skipped ? `, skipped ${r.skipped} already on the list` : ''}.`); } }}>
      <Textarea rows={6} placeholder={'One company per line: name, website, city\nBay Area Movers, bayareamovers.com, San Jose CA\nAcme Moving, acmemoving.com, Oakland CA'} value={text} onChange={e => setText(e.target.value)} />
      <p className="text-xs text-muted-foreground">Up to 500 at a time. Copying columns from a spreadsheet works too.</p>
      <Button type="submit" disabled={busy || !text.trim()}>Add to {tier === 'legend' ? 'legends' : 'main list'}</Button>
    </form>}
  </CardContent></Card>;
}

function CompetitorRow({ c, us, open, onToggle, post, busy, setBusy, setNotice, reload }: {
  c: Competitor; us: Metrics; open: boolean; onToggle: () => void; post: (b: Record<string, unknown>, l?: string) => Promise<any>;
  busy: string; setBusy: (s: string) => void; setNotice: (s: string) => void; reload: () => Promise<unknown>;
}) {
  const auth = useAuth();
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [details, setDetails] = useState({ name: c.name, website: c.website, location: c.location });
  const [newAction, setNewAction] = useState('');
  useEffect(() => {
    if (!open) return;
    setMetrics(Object.fromEntries(METRICS.map(m => [m.key, c.metrics[m.key]?.toString() ?? ''])));
    setNotes(Object.fromEntries(NOTES.map(n => [n.key, c.notes?.[n.key] || ''])));
    setDetails({ name: c.name, website: c.website, location: c.location });
  }, [open, c]);
  const cmp = compareToUs(us, c.metrics);
  const openCount = c.actions.filter(a => !a.done).length;

  const analyze = async () => {
    setBusy(`analyze:${c.id}`); setNotice('');
    try {
      const r = await apiFetch<{ websiteRead: boolean; websiteError?: string }>(auth, `/api/admin/competitors/${c.id}/analyze`, {});
      setNotice(r.websiteRead ? `${c.name} analyzed from their website.` : `${c.name} analyzed from your notes only${r.websiteError ? ` (website: ${r.websiteError})` : ''}.`);
      await reload();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Analysis failed.'); }
    finally { setBusy(''); }
  };

  return <Card className={`bg-white ${c.status === 'passed' ? 'opacity-70' : ''}`}><CardContent className="p-0">
    <button className="w-full text-left p-4 flex flex-wrap items-center gap-3 justify-between" onClick={onToggle} aria-expanded={open}>
      <div>
        <p className="font-bold">{c.name} {c.status === 'passed' && <Badge className="ml-1 bg-green-600">Passed</Badge>}</p>
        <p className="text-xs text-muted-foreground">{[c.location, c.website.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ') || 'No details yet'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {c.score.known ? <span className="font-medium">Ahead {c.score.ahead} · Behind {c.score.behind}</span> : <span className="text-muted-foreground">No numbers yet</span>}
        {c.analysis && <span className={`px-2 py-0.5 rounded-full font-bold ${THREAT[c.analysis.threat]}`}>{c.analysis.threat} threat</span>}
        {openCount > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold">{openCount} actions</span>}
      </div>
    </button>
    {open && <div className="border-t p-4 space-y-6">
      <PassPlan us={us} them={c.metrics} />
      <section className="space-y-2">
        <h3 className="font-bold">Numbers: us vs them</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {METRICS.map(m => <label key={m.key} className="text-sm space-y-1">
            <span className="font-medium">{m.label}</span>
            <Input inputMode="decimal" placeholder={m.hint} value={metrics[m.key] ?? ''} onChange={e => setMetrics({ ...metrics, [m.key]: e.target.value })} />
            <span className={`text-xs block ${cmp[m.key] === 'ahead' ? 'text-green-700' : cmp[m.key] === 'behind' ? 'text-red-700' : 'text-muted-foreground'}`}>
              Us: {fmt(m.key, us[m.key])} {cmp[m.key] === 'ahead' ? '· we lead' : cmp[m.key] === 'behind' ? '· they lead' : cmp[m.key] === 'tied' ? '· tied' : ''}
            </span>
          </label>)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">Social profiles</h3>
        <SocialLinks socials={c.socials} />
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!busy || !c.website} onClick={async () => { const r = await post({ action: 'find-socials', id: c.id }); if (r) setNotice(r.found ? `Found ${r.found} social profile${r.found === 1 ? '' : 's'} on their website.` : 'No social links on their website. Add them below.'); }}>{c.website ? 'Find on their website' : 'Add their website to find these'}</Button></div>
        <Textarea rows={2} placeholder="Or paste their profile links, one per line (Facebook, Instagram, Yelp, Google…)" defaultValue={Object.values(c.socials || {}).join('\n')} onBlur={e => { const v = e.target.value; if (v.trim() !== Object.values(c.socials || {}).join('\n')) void post({ action: 'update', id: c.id, socials: v.split(/\s+/).filter(Boolean) }); }} />
        <h3 className="font-bold">What we know</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} aria-label="Company name" />
          <Input value={details.website} placeholder="Website" onChange={e => setDetails({ ...details, website: e.target.value })} aria-label="Website" />
          <Input value={details.location} placeholder="City, state" onChange={e => setDetails({ ...details, location: e.target.value })} aria-label="Location" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {NOTES.map(n => <label key={n.key} className="text-sm space-y-1"><span className="font-medium">{n.label}</span>
            <Textarea rows={2} placeholder={n.placeholder} value={notes[n.key] ?? ''} onChange={e => setNotes({ ...notes, [n.key]: e.target.value })} /></label>)}
        </div>
        <Button disabled={!!busy} onClick={async () => { if (await post({ action: 'update', id: c.id, ...details, metrics, notes })) setNotice(`${c.name} saved.`); }}>Save</Button>
      </section>

      <section className="space-y-3 bg-slate-50 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">AI analysis</h3>
          <Button variant="outline" disabled={!!busy} onClick={analyze}>{busy === `analyze:${c.id}` ? 'Analyzing…' : c.analyzedAt ? 'Re-analyze' : 'Analyze with AI'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Reads their website and your notes and numbers (save first), then writes a 30-day plan to beat them. {c.analyzedAt ? `Last run ${new Date(c.analyzedAt).toLocaleString()}.` : ''}</p>
        {c.intel && <div className="space-y-3 text-sm">
          <p>{c.intel.summary}</p>
          {c.intel.websiteError && <p className="text-xs text-amber-700">Website not read: {c.intel.websiteError}</p>}
          <div className="grid md:grid-cols-2 gap-4">
            <Info title="Their prices" text={c.intel.pricing} />
            <Info title="Their promotions" text={c.intel.promotions} />
            <Info title="Services" list={c.intel.services} />
            <Info title="How they sell" list={c.intel.sellingPoints} />
            {c.analysis && <><Info title="What they do better" list={c.analysis.strengths} /><Info title="Where we can beat them" list={c.analysis.weaknesses} /></>}
          </div>
        </div>}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">Actions to pass them</h3>
        {sortActions(c.actions).map(a => <div key={a.id} className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={a.done} aria-label={a.text} onChange={e => void post({ action: 'toggle-action', id: c.id, actionId: a.id, done: e.target.checked })} />
          <div className="flex-1"><p className={a.done ? 'line-through text-muted-foreground' : ''}>{a.text}</p><p className="text-xs text-muted-foreground">{a.area} · {a.impact} impact</p></div>
          <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void post({ action: 'remove-action', id: c.id, actionId: a.id })}>Remove</button>
        </div>)}
        {c.actions.length === 0 && <p className="text-sm text-muted-foreground">Run the AI analysis for a plan, or add your own.</p>}
        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); if (await post({ action: 'add-action', id: c.id, text: newAction })) setNewAction(''); }}>
          <Input placeholder="Add an action" value={newAction} onChange={e => setNewAction(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!!busy || !newAction.trim()}>Add</Button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {c.status === 'passed'
          ? <Button variant="outline" disabled={!!busy} onClick={() => void post({ action: 'pass', id: c.id, passed: false })}>Move back to tracking</Button>
          : <Button disabled={!!busy} onClick={async () => { if (await post({ action: 'pass', id: c.id })) setNotice(`${c.name} passed. On to the next one.`); }}>Mark as passed</Button>}
        <Button variant="outline" disabled={!!busy} onClick={() => void post({ action: 'update', id: c.id, tier: c.tier === 'legend' ? 'challenger' : 'legend' })}>Move to {c.tier === 'legend' ? 'main list' : 'legends'}</Button>
        <Button variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => { if (confirm(`Delete ${c.name} and its notes?`)) void post({ action: 'delete', id: c.id }); }}>Delete</Button>
        {c.passedAt && <p className="text-xs text-muted-foreground self-center">Passed {new Date(c.passedAt).toLocaleDateString()} {c.passedHow === 'numbers' ? '(on the numbers)' : '(marked by hand)'}</p>}
      </div>
    </div>}
  </CardContent></Card>;
}

function Info({ title, text, list }: { title: string; text?: string; list?: string[] }) {
  return <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
    {list ? (list.length ? <ul className="list-disc pl-5 space-y-1">{list.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-muted-foreground">Nothing found.</p>) : <p className="whitespace-pre-line">{text || '—'}</p>}
  </div>;
}

function ActionBoard({ items, onToggle, onOpen }: { items: (ActionItem & { competitor: Competitor })[]; onToggle: (cid: string, aid: string) => void; onOpen: (c: Competitor) => void }) {
  if (!items.length) return <p className="text-muted-foreground">No open actions. Analyze a competitor to get a plan.</p>;
  return <Card className="bg-white"><CardContent className="p-4 space-y-3">
    <p className="text-sm text-muted-foreground">Every open action across competitors you haven’t passed, highest impact first. Tick one off when it’s done.</p>
    {items.map(a => <div key={`${a.competitor.id}:${a.id}`} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2">
      <input type="checkbox" className="mt-1" aria-label={a.text} onChange={() => onToggle(a.competitor.id, a.id)} />
      <div className="flex-1"><p>{a.text}</p><p className="text-xs text-muted-foreground">{a.impact} impact · {a.area} · <button className="underline" onClick={() => onOpen(a.competitor)}>{a.competitor.name}</button></p></div>
    </div>)}
  </CardContent></Card>;
}

/** "To pass them": every number where they still lead us. */
function PassPlan({ us, them }: { us: Metrics; them: Metrics }) {
  const gaps = passGaps(us, them);
  const known = METRICS.filter(m => typeof us[m.key] === 'number' && typeof them[m.key] === 'number').length;
  return <section className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-1">
    <p className="font-bold">To pass them</p>
    {known < 2 ? <p>Enter at least two numbers for both of you (below, and under Our numbers) to compare.</p>
      : !gaps.length ? <p className="text-green-800 font-semibold">You lead on every number you both have. Click “Mark as passed” or “Check for passes”.</p>
      : <ul className="list-disc pl-5">{gaps.map(g => <li key={g.key}><b>{g.label}:</b> they {fmt(g.key, g.theirs)}, you {fmt(g.key, g.ours)}{g.tied ? ' (tied: beat it by one)' : ` → you need ${fmt(g.key, Math.max(0, g.theirs - g.ours) + (['googleRating'].includes(g.key) ? 0.1 : 1))} more`}</li>)}</ul>}
  </section>;
}

function SocialLinks({ socials }: { socials: Record<string, string> }) {
  const entries = Object.entries(socials || {});
  if (!entries.length) return <p className="text-sm text-muted-foreground">No social profiles yet.</p>;
  return <div className="flex flex-wrap gap-2">{entries.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noreferrer noopener" className="text-xs px-2 py-1 rounded-full border hover:bg-slate-50">{SOCIAL_LABEL[k] || k}</a>)}</div>;
}

/** Side-by-side social presence for tracked competitors vs us, with the gap to the next one ahead. */
function SocialView({ competitors, us, busy, post, setNotice, onOpen }: { competitors: Competitor[]; us: Data['us']; busy: boolean; post: (b: Record<string, unknown>, l?: string) => Promise<any>; setNotice: (s: string) => void; onOpen: (c: Competitor) => void }) {
  const rows = [...competitors].sort((a, b) => (b.metrics.followers ?? -1) - (a.metrics.followers ?? -1));
  const ours = us.metrics.followers;
  const ahead = typeof ours === 'number' ? rows.filter(c => typeof c.metrics.followers === 'number' && c.metrics.followers > ours).sort((a, b) => (a.metrics.followers as number) - (b.metrics.followers as number))[0] : undefined;
  const missing = competitors.filter(c => c.website && !Object.keys(c.socials || {}).length);
  return <div className="space-y-4">
    <Card className="bg-slate-900 text-white"><CardContent className="p-5 space-y-2 text-sm">
      <p className="font-black text-lg">Social media: you vs them</p>
      <p className="text-slate-300">Your followers: <b className="text-white">{typeof ours === 'number' ? ours.toLocaleString() : 'not entered'}</b> · posts/month: <b className="text-white">{us.metrics.postsPerMonth ?? '—'}</b> · likes/post: <b className="text-white">{us.metrics.avgPostLikes ?? '—'}</b></p>
      {ahead ? <p>Next to pass on followers: <b>{ahead.name}</b> with {(ahead.metrics.followers as number).toLocaleString()}: you need <b>{((ahead.metrics.followers as number) - (ours as number) + 1).toLocaleString()} more</b>.</p> : typeof ours === 'number' ? <p>You lead every tracked competitor with a follower count.</p> : <p>Enter your followers under Our numbers to see who’s next.</p>}
      <SocialLinks socials={us.socials} />
    </CardContent></Card>
    {missing.length > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { let found = 0; for (const c of missing.slice(0, 10)) { const r = await post({ action: 'find-socials', id: c.id }); if (r?.found) found++; } setNotice(`Checked ${Math.min(10, missing.length)} websites; found profiles for ${found}.`); }}>Find social profiles for {Math.min(10, missing.length)} competitors from their websites</Button>}
    <p className="text-xs text-muted-foreground">Profiles come from links on each company’s own website (or you paste them). Follower counts are entered by hand on each competitor: Facebook, Instagram, TikTok and X restrict automatic access to these numbers.</p>
    <Card className="bg-white"><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground border-b">{['Company', 'Profiles', 'Followers', 'Posts/month', 'Likes/post', ''].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.map(c => <tr key={c.id} className="border-b last:border-0">
        <td className="p-3 font-semibold">{c.name}</td><td className="p-3"><SocialLinks socials={c.socials} /></td>
        <td className={`p-3 ${typeof ours === 'number' && typeof c.metrics.followers === 'number' ? (c.metrics.followers > ours ? 'text-red-700' : 'text-green-700') : ''}`}>{c.metrics.followers?.toLocaleString() ?? '—'}</td>
        <td className="p-3">{c.metrics.postsPerMonth ?? '—'}</td><td className="p-3">{c.metrics.avgPostLikes ?? '—'}</td>
        <td className="p-3"><Button size="sm" variant="ghost" onClick={() => onOpen(c)}>Open</Button></td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Track competitors first (Main list, or from the Mover Registry).</td></tr>}</tbody>
    </table></CardContent></Card>
  </div>;
}

function OurNumbers({ us, busy, onSave }: { us: Data['us']; busy: boolean; onSave: (m: Record<string, string>, extra: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(METRICS.map(m => [m.key, us.manual[m.key]?.toString() ?? ''])));
  const [authority, setAuthority] = useState(us.hasAuthority);
  const [socials, setSocials] = useState(Object.values(us.socials || {}).join('\n'));
  return <Card className="bg-white"><CardContent className="p-6 space-y-4">
    <p className="text-sm text-muted-foreground">Revenue, customers and repeat rate fill in automatically from the last 12 months of paid bookings. Enter the rest (Google reviews, social followers). A number you enter replaces the automatic one.</p>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {METRICS.map(m => <label key={m.key} className="text-sm space-y-1"><span className="font-medium">{m.label}</span>
        <Input inputMode="decimal" placeholder={typeof us.auto[m.key] === 'number' ? `Auto: ${fmt(m.key, us.auto[m.key])}` : m.hint} value={values[m.key] ?? ''} onChange={e => setValues({ ...values, [m.key]: e.target.value })} />
        <span className="text-xs text-muted-foreground block">Using: {fmt(m.key, us.metrics[m.key])}</span></label>)}
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={authority} onChange={e => setAuthority(e.target.checked)} />We have our own USDOT number and household-goods authority (see GitHub issue #76)</label>
    <label className="text-sm space-y-1 block"><span className="font-medium">Our social profiles</span><Textarea rows={3} placeholder="One link per line: Facebook, Instagram, TikTok, Yelp, Google…" value={socials} onChange={e => setSocials(e.target.value)} /></label>
    <Button disabled={busy} onClick={() => onSave(values, { hasAuthority: authority, socials: socials.split(/\s+/).filter(Boolean) })}>Save our numbers</Button>
  </CardContent></Card>;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">building…</span>;
  const min = Math.min(...values), max = Math.max(...values), w = 120, h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (max === min ? h / 2 : ((v - min) / (max - min)) * (h - 4) + 2)}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" /></svg>;
}

/**
 * The growth log: our numbers day by day (saved by the daily job), with
 * every competitor passed and every action completed, so you can see what
 * moved the needle.
 */
function ProgressView({ progress, us }: { progress?: Progress; us: Metrics }) {
  if (!progress) return <p>Loading…</p>;
  const h = progress.history;
  const series = (fn: (x: Progress['history'][number]) => number | undefined) => h.map(fn).filter((v): v is number => typeof v === 'number');
  const rows: { label: string; values: number[]; format: (n: number) => string }[] = [
    ...METRICS.filter(m => h.some(x => typeof x.metrics[m.key] === 'number')).map(m => ({ label: m.label, values: series(x => x.metrics[m.key]), format: (n: number) => fmt(m.key, n) })),
    { label: 'Competitors passed', values: series(x => x.passed), format: (n: number) => String(n) },
    { label: 'Actions completed', values: series(x => x.actionsDone), format: (n: number) => String(n) },
  ];
  const events = [
    ...progress.passes.map(p => ({ at: p.at, text: `Passed ${p.name}${p.tier === 'legend' ? ' (legend)' : ''}`, sub: p.how === 'numbers' ? 'On the numbers' : 'Marked by hand', kind: 'pass' as const })),
    ...progress.actions.map(a => ({ at: a.at, text: a.text, sub: `${a.area} · ${a.impact} impact · to beat ${a.competitor}`, kind: 'action' as const })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return <div className="space-y-6">
    <Card className="bg-white"><CardContent className="p-5 space-y-3">
      <h3 className="font-bold">Your numbers over time</h3>
      <p className="text-sm text-muted-foreground">Saved once a day automatically{h.length ? ` since ${h[0].day}` : ' starting tomorrow'}. Revenue, customers and repeat rate come from bookings; enter reviews and followers under Our numbers to track them too.</p>
      {!h.length ? <p className="text-sm text-muted-foreground">No history yet. The first snapshot is taken by tonight’s registry job.</p> :
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b"><th className="p-2 font-medium">Metric</th><th className="p-2 font-medium">First</th><th className="p-2 font-medium">Now</th><th className="p-2 font-medium">Change</th><th className="p-2 font-medium">Trend</th></tr></thead>
          <tbody>{rows.filter(r => r.values.length).map(r => { const first = r.values[0], last = r.values[r.values.length - 1], d = last - first; return <tr key={r.label} className="border-b last:border-0">
            <td className="p-2 font-medium">{r.label}</td><td className="p-2">{r.format(first)}</td><td className="p-2">{r.format(last)}</td>
            <td className={`p-2 font-semibold ${d > 0 ? 'text-green-700' : d < 0 ? 'text-red-700' : 'text-muted-foreground'}`}>{d > 0 ? '+' : ''}{Number.isInteger(d) ? d.toLocaleString() : d.toFixed(1)}</td>
            <td className="p-2"><Spark values={r.values} /></td></tr>; })}</tbody></table>}
    </CardContent></Card>
    <Card className="bg-white"><CardContent className="p-5 space-y-3">
      <h3 className="font-bold">What you did and who you passed</h3>
      {!events.length ? <p className="text-sm text-muted-foreground">Complete actions and pass competitors; each one is logged here with its date.</p> :
        <ul className="space-y-3">{events.slice(0, 200).map((e, i) => <li key={i} className={`border-l-2 pl-3 text-sm ${e.kind === 'pass' ? 'border-green-500' : 'border-accent/50'}`}>
          <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleDateString()}</p><p className={e.kind === 'pass' ? 'font-bold text-green-800' : ''}>{e.text}</p><p className="text-xs text-muted-foreground">{e.sub}</p></li>)}</ul>}
      <p className="text-xs text-muted-foreground">Current: {METRICS.filter(m => typeof us[m.key] === 'number').map(m => `${m.label} ${fmt(m.key, us[m.key])}`).join(' · ') || 'enter your numbers to compare'}.</p>
    </CardContent></Card>
  </div>;
}

export default function AdminCompetitorsPage() { return <EmployeeLayout isAdmin><Competitors /></EmployeeLayout>; }
