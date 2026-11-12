'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

type Research = {
  summary: string; ownerOrFounder: { name: string; role: string; background: string }; history: string; services: string[]; serviceArea: string;
  fleetAndFacilities: string; reputationSignals: string[]; socialPresence: { platform: string; url: string; note: string }[];
  fit: { score: number; verdict: 'strong' | 'possible' | 'weak'; reasons: string[]; concerns: string[] };
  talkingPoints: string[]; questionsToAsk: string[]; openingMessage: string; sources: string[];
};
type Saved = { name: string; website: string; phone: string; email: string; research: Research; siteError: string | null; at: string | null };
export type ResearchTarget = { key: string; dot?: string; state?: string; name: string; website?: string; city?: string };

const VERDICT = { strong: 'bg-green-100 text-green-800', possible: 'bg-amber-100 text-amber-800', weak: 'bg-red-100 text-red-800' };

/** Pre-call AI briefing on a company (agent network recruiting). */
export function ResearchPanel({ target, onClose }: { target: ResearchTarget; onClose: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiFetch<{ result: Saved | null }>(auth, `/api/admin/agents/research?key=${encodeURIComponent(target.key)}`).then(r => setSaved(r.result)).catch(() => setSaved(null)), [auth, target.key]);
  useEffect(() => { void load(); }, [load]);
  const run = async () => {
    setBusy(true);
    try { await apiFetch(auth, '/api/admin/agents/research', { dot: target.dot, state: target.state, name: target.name, website: target.website, city: target.city }); await load(); toast({ title: 'Research ready' }); }
    catch (e) { toast({ variant: 'destructive', title: 'Research didn’t finish', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  const r = saved?.research;
  const List = ({ title, items }: { title: string; items: string[] }) => items.length ? <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{title}</p><ul className="list-disc pl-5 space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null;

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Company research">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative w-full max-w-2xl h-full bg-gray-50 overflow-y-auto p-6 space-y-5 shadow-2xl text-sm">
      <div className="flex justify-between gap-3"><div><h2 className="text-2xl font-black text-primary">{target.name}</h2><p className="text-muted-foreground">Pre-call research{target.city ? ` · ${target.city}` : ''}</p></div><Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button></div>
      <div className="flex flex-wrap gap-2 items-center"><Button disabled={busy} onClick={run}>{busy ? 'Researching… (about 30 seconds)' : r ? 'Research again' : 'Research this company'}</Button>{saved?.at && <span className="text-xs text-muted-foreground">Last run {new Date(saved.at).toLocaleString()}</span>}</div>
      <p className="text-xs text-muted-foreground">AI reads their federal record, website, About page and the social profiles their site links to. Public business information only; verify before you rely on it.</p>
      {saved === undefined ? <p>Loading…</p> : !r ? <p className="text-muted-foreground">No research yet.</p> : <>
        <section className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-3"><span className={`px-3 py-1 rounded-full font-black ${VERDICT[r.fit.verdict]}`}>{r.fit.score}/100 · {r.fit.verdict} fit</span></div>
          <p>{r.summary}</p>
          <div className="grid sm:grid-cols-2 gap-3"><List title="Why they fit" items={r.fit.reasons} /><List title="Concerns" items={r.fit.concerns} /></div>
        </section>
        <section className="bg-white rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Owner / founder</p>
          <p><b>{r.ownerOrFounder.name}</b>{r.ownerOrFounder.role ? ` · ${r.ownerOrFounder.role}` : ''}</p>
          <p>{r.ownerOrFounder.background}</p>
          {(saved?.phone || saved?.email) && <p>{saved.phone && <a className="underline mr-3" href={`tel:${saved.phone}`}>{saved.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</a>}{saved.email && <a className="underline" href={`mailto:${saved.email}`}>{saved.email}</a>}</p>}
        </section>
        <section className="bg-white rounded-xl p-4 space-y-3">
          <p><b>History:</b> {r.history}</p><p><b>Service area:</b> {r.serviceArea}</p><p><b>Fleet & facilities:</b> {r.fleetAndFacilities}</p>
          <List title="Services" items={r.services} /><List title="Reputation signals" items={r.reputationSignals} />
          {r.socialPresence.length > 0 && <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Social presence</p><ul className="space-y-1">{r.socialPresence.map((s, i) => <li key={i}><b>{s.platform}</b>{s.url && <> · <a className="underline break-all" href={s.url} target="_blank" rel="noreferrer noopener">{s.url.replace(/^https?:\/\//, '')}</a></>}{s.note ? ` · ${s.note}` : ''}</li>)}</ul></div>}
        </section>
        <section className="bg-white rounded-xl p-4 space-y-3"><List title="Talking points" items={r.talkingPoints} /><List title="Questions to ask" items={r.questionsToAsk} /></section>
        <section className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex justify-between"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Opening email</p><button className="text-xs underline" onClick={() => { void navigator.clipboard.writeText(r.openingMessage); toast({ title: 'Copied' }); }}>Copy</button></div>
          <p className="whitespace-pre-wrap">{r.openingMessage}</p>
        </section>
        {(r.sources.length > 0 || saved?.siteError) && <p className="text-xs text-muted-foreground">Sources: {r.sources.map(s => <a key={s} className="underline mr-2 break-all" href={s} target="_blank" rel="noreferrer noopener">{s.replace(/^https?:\/\//, '')}</a>)}{saved?.siteError ? `Website: ${saved.siteError}` : ''}</p>}
      </>}
    </div>
  </div>;
}

export const researchKeyFor = (t: { dot?: string; website?: string; name?: string }) => t.dot || (t.website || t.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
