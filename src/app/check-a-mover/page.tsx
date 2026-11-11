'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Search, ShieldCheck, HelpCircle } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { US_STATES } from '@/lib/registry';

type Result = { dot: string; name: string; legalName: string; city: string; state: string; active: boolean; trucks: number };
type Check = {
  company: { dot: string; mc: string; name: string; legalName: string; city: string; state: string; trucks: number; drivers: number; since: string; householdGoods: boolean };
  verdict: { level: 'good' | 'caution' | 'bad'; headline: string; checks: { ok: boolean | null; text: string }[]; notes: string[] };
  links: { safer: string; protectYourMove: string };
};

const RED_FLAGS = [
  'They won’t come look at your things (in person or by video) before quoting a big move.',
  'They want a large cash deposit before the move.',
  'The quote is far below everyone else’s.',
  'They don’t give you FMCSA’s “Your Rights and Responsibilities When You Move” booklet for an interstate move.',
  'The company name on the truck or paperwork isn’t the one you booked (it may be a broker).',
  'There’s no physical address, or the phone is answered “movers” instead of a company name.',
];
const LEVEL = {
  good: { icon: CheckCircle2, cls: 'bg-green-50 border-green-200 text-green-900' },
  caution: { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200 text-amber-900' },
  bad: { icon: XCircle, cls: 'bg-red-50 border-red-200 text-red-900' },
};

export default function CheckAMoverPage() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCheck(null); setBusy(true);
    try {
      const r = await fetch(`/api/public/check-mover?${new URLSearchParams({ q, state })}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Search failed.');
      setResults(d.results);
      if (d.results.length === 1) await open(d.results[0].dot);
    } catch (err) { setError(err instanceof Error ? err.message : 'Search failed.'); }
    finally { setBusy(false); }
  };
  const open = async (dot: string) => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/public/check-mover/${dot}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lookup failed.');
      setCheck(d);
      setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) { setError(err instanceof Error ? err.message : 'Lookup failed.'); }
    finally { setBusy(false); }
  };

  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 space-y-8">
        <header className="text-center space-y-3">
          <ShieldCheck className="h-12 w-12 text-accent mx-auto" />
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Check a <span className="text-accent">mover</span></h1>
          <p className="text-muted-foreground text-lg">Is your moving company licensed and insured? Look it up in the federal records, free.</p>
        </header>

        <form onSubmit={search} className="bg-white rounded-3xl shadow-xl p-5 sm:p-6 space-y-3">
          <label className="text-sm font-semibold text-primary" htmlFor="mover-q">Company name, USDOT number or MC number</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input id="mover-q" required minLength={2} placeholder="e.g. Bay Area Movers, or USDOT 1234567" value={q} onChange={e => setQ(e.target.value)} className="h-12" />
            <select aria-label="State (optional)" className="h-12 border rounded-md px-3 bg-white" value={state} onChange={e => setState(e.target.value)}><option value="">Any state</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <Button type="submit" className="h-12 px-6 font-bold" disabled={busy}><Search className="h-4 w-4 mr-1" />{busy ? 'Checking…' : 'Check'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Source: U.S. Department of Transportation (FMCSA) public records, updated daily.</p>
        </form>

        {error && <p role="alert" className="text-center text-red-700 font-medium">{error}</p>}

        {results && !check && <section className="space-y-2" aria-live="polite">
          {results.length === 0 ? <div className="bg-white rounded-2xl p-6 text-center space-y-2"><HelpCircle className="h-8 w-8 mx-auto text-amber-600" /><p className="font-bold">No registered moving company found.</p><p className="text-sm text-muted-foreground">Check the spelling, or ask the company for its USDOT number. Every mover that crosses state lines must have one, and a legitimate company will give it to you.</p></div>
            : results.map(r => <button key={r.dot} onClick={() => void open(r.dot)} className="w-full text-left bg-white rounded-2xl p-4 hover:shadow-md transition flex justify-between gap-3">
              <span><span className="font-bold text-primary block">{r.name}</span><span className="text-sm text-muted-foreground">{r.city}, {r.state} · USDOT {r.dot}{r.legalName !== r.name ? ` · ${r.legalName}` : ''}</span></span>
              <span className={`text-xs font-bold self-center px-2 py-1 rounded-full ${r.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.active ? 'Active' : 'Inactive'}</span>
            </button>)}
        </section>}

        {check && (() => { const L = LEVEL[check.verdict.level]; return <section id="verdict" className="space-y-4 scroll-mt-28" aria-live="polite">
          <div className={`rounded-3xl border p-6 space-y-1 ${L.cls}`}>
            <p className="flex items-center gap-2 text-xl font-black"><L.icon className="h-6 w-6" />{check.verdict.headline}</p>
            <p className="font-semibold">{check.company.name}{check.company.legalName !== check.company.name ? ` (${check.company.legalName})` : ''}</p>
            <p className="text-sm">{check.company.city}, {check.company.state} · USDOT {check.company.dot}{check.company.mc ? ` · ${check.company.mc}` : ''} · {check.company.trucks} truck{check.company.trucks === 1 ? '' : 's'}{check.company.since ? ` · registered ${check.company.since.slice(0, 4)}` : ''}</p>
          </div>
          <ul className="bg-white rounded-3xl p-6 space-y-3">
            {check.verdict.checks.map((c, i) => <li key={i} className="flex gap-3 text-sm">{c.ok === true ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : c.ok === false ? <XCircle className="h-5 w-5 text-red-600 shrink-0" /> : <HelpCircle className="h-5 w-5 text-amber-600 shrink-0" />}<span>{c.text}</span></li>)}
            {!check.company.householdGoods && <li className="flex gap-3 text-sm"><AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" /><span>Not registered to carry household goods.</span></li>}
          </ul>
          {check.verdict.notes.map((n, i) => <p key={i} className="text-sm text-muted-foreground">{n}</p>)}
          <div className="flex flex-wrap gap-3 text-sm"><a className="underline" href={check.links.safer} target="_blank" rel="noreferrer noopener">See the official FMCSA record</a><button className="underline" onClick={() => setCheck(null)}>Back to results</button></div>
        </section>; })()}

        <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-3 text-center">
          <p className="text-2xl font-black">Want a mover we’ve already vetted?</p>
          <p className="text-slate-300">Every Wont Stop Moving provider and partner is checked for licensing and insurance, and we keep checking every day.</p>
          <Button asChild size="lg" className="font-black uppercase"><Link href="/quote?utm_source=check-a-mover&utm_medium=tool">Get a free quote</Link></Button>
        </section>

        <section className="bg-white rounded-3xl p-6 space-y-3">
          <h2 className="text-xl font-black text-primary">Red flags to watch for</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">{RED_FLAGS.map(f => <li key={f}>{f}</li>)}</ul>
          <p className="text-sm text-muted-foreground">More tips from the U.S. government: <a className="underline" href="https://www.fmcsa.dot.gov/protect-your-move" target="_blank" rel="noreferrer noopener">FMCSA Protect Your Move</a>.</p>
        </section>
      </div>
    </div>
  </PublicLayout>;
}
