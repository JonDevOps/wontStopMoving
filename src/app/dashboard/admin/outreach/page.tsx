'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { OUTREACH_KINDS, OUTREACH_STATUSES, type OutreachKind, type OutreachStatus } from '@/lib/outreach';

type Item = { id: string; name: string; kind: OutreachKind; url: string; why: string; phone?: string; custom: boolean; status: OutreachStatus; listingUrl: string; notes: string; updatedAt: string | null };
type Broker = { dot: string; name: string; city: string; state: string; phone: string; site: string; units: number; hauls: boolean };
type Data = { items: Item[]; brokers: Broker[]; states: string[] };

const STATUS_STYLE: Record<OutreachStatus, string> = {
  todo: 'bg-gray-100 text-gray-700', 'in-progress': 'bg-amber-100 text-amber-800', listed: 'bg-green-100 text-green-800', declined: 'bg-slate-100 text-slate-500',
};
const phoneFmt = (p: string) => p.replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');

function Row({ item, onSave, onRemove }: { item: Item; onSave: (id: string, patch: Pick<Item, 'status' | 'listingUrl' | 'notes'>) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ status: item.status, listingUrl: item.listingUrl, notes: item.notes });
  const [busy, setBusy] = useState(false);
  const save = async (patch = draft) => { setBusy(true); try { await onSave(item.id, patch); } finally { setBusy(false); } };
  return (
    <li className="bg-white rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <button type="button" className="font-bold text-left hover:underline" onClick={() => setOpen(o => !o)} aria-expanded={open}>{item.name}</button>
          {item.url && <a className="ml-2 inline-flex items-center text-xs text-muted-foreground underline" href={item.url} target="_blank" rel="noreferrer noopener">site <ExternalLink className="h-3 w-3 ml-0.5" /></a>}
          {item.phone && <a className="ml-2 text-xs text-muted-foreground underline" href={`tel:${item.phone}`}>{phoneFmt(item.phone)}</a>}
          {item.why && <p className="text-xs text-muted-foreground">{item.why}</p>}
        </div>
        <select aria-label={`Status for ${item.name}`} className={`rounded-full px-3 py-1 text-xs font-bold border-0 ${STATUS_STYLE[item.status]}`} value={item.status} disabled={busy}
          onChange={e => { const status = e.target.value as OutreachStatus; setDraft(d => ({ ...d, status })); void save({ ...draft, status }); }}>
          {(Object.keys(OUTREACH_STATUSES) as OutreachStatus[]).map(s => <option key={s} value={s}>{OUTREACH_STATUSES[s]}</option>)}
        </select>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-start">
          <Input aria-label="Our listing link" placeholder="Our listing / profile link" value={draft.listingUrl} onChange={e => setDraft(d => ({ ...d, listingUrl: e.target.value }))} />
          <Input aria-label="Notes" placeholder="Notes (login owner, cost, contact…)" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>Save</Button>
            {item.custom && <Button size="sm" variant="outline" disabled={busy} onClick={() => void onRemove(item.id)}>Remove</Button>}
          </div>
        </div>
      )}
      {!open && item.listingUrl && <a className="block text-xs text-green-700 underline mt-1 truncate" href={item.listingUrl} target="_blank" rel="noreferrer noopener">{item.listingUrl}</a>}
    </li>
  );
}

function Outreach() {
  const auth = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<OutreachStatus | 'all'>('all');
  const [custom, setCustom] = useState({ name: '', url: '', kind: 'other' as OutreachKind });
  const load = useCallback(async () => {
    try { setData(await apiFetch<Data>(auth, '/api/admin/outreach')); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not load the tracker.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>) => {
    try { await apiFetch(auth, '/api/admin/outreach', body); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
  };
  const groups = useMemo(() => {
    const items = (data?.items || []).filter(i => filter === 'all' || i.status === filter);
    return (Object.keys(OUTREACH_KINDS) as OutreachKind[]).map(k => [k, items.filter(i => i.kind === k)] as const).filter(([, list]) => list.length);
  }, [data, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of data?.items || []) c[i.status] = (c[i.status] || 0) + 1;
    return c;
  }, [data]);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-black text-primary uppercase">Directories & partners</h1>
        <p className="text-muted-foreground">Every listing site, marketplace and van line we should be on. Click a name to save our listing link and notes.</p>
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All ({data?.items.length ?? 0})</Button>
        {(Object.keys(OUTREACH_STATUSES) as OutreachStatus[]).map(s => <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>{OUTREACH_STATUSES[s]} ({counts[s] || 0})</Button>)}
      </div>
      {!data ? <p>Loading…</p> : groups.map(([kind, list]) => (
        <section key={kind} className="space-y-2">
          <h2 className="font-black text-primary">{OUTREACH_KINDS[kind]} <Badge variant="outline">{list.filter(i => i.status === 'listed').length}/{list.length} done</Badge></h2>
          <ul className="space-y-2">{list.map(i => <Row key={`${i.id}:${i.status}:${i.updatedAt}`} item={i} onSave={(id, patch) => act({ id, ...patch })} onRemove={id => act({ id, action: 'remove' })} />)}</ul>
        </section>
      ))}

      <section className="bg-white rounded-xl p-4 space-y-2">
        <h2 className="font-black text-primary">Add another</h2>
        <form className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]" onSubmit={e => { e.preventDefault(); void act({ action: 'add', ...custom }).then(() => setCustom({ name: '', url: '', kind: 'other' })); }}>
          <Input aria-label="Name" placeholder="Name" required minLength={2} value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} />
          <Input aria-label="Website" placeholder="https://…" value={custom.url} onChange={e => setCustom(c => ({ ...c, url: e.target.value }))} />
          <select aria-label="Kind" className="h-10 rounded-md border px-2 text-sm bg-white" value={custom.kind} onChange={e => setCustom(c => ({ ...c, kind: e.target.value as OutreachKind }))}>
            {(Object.keys(OUTREACH_KINDS) as OutreachKind[]).map(k => <option key={k} value={k}>{OUTREACH_KINDS[k]}</option>)}
          </select>
          <Button type="submit">Add</Button>
        </form>
      </section>

      {data && <section className="space-y-2">
        <h2 className="font-black text-primary">Moving brokers to contact ({data.brokers.length})</h2>
        <p className="text-sm text-muted-foreground">Brokers book moves and hire carriers to do them. From the DOT registry in {data.states.join(', ') || 'your watched areas'}, largest first. Add one to the tracker to work it.</p>
        {!data.brokers.length ? <p className="text-sm text-muted-foreground">None found (or the registry isn’t loaded for these states).</p> :
          <ul className="grid sm:grid-cols-2 gap-2">{data.brokers.map(b => (
            <li key={b.dot} className="bg-white rounded-xl p-3 text-sm flex justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.city}, {b.state} · USDOT {b.dot}{b.hauls ? ' · also hauls' : ' · broker only'}{b.phone ? ` · ${phoneFmt(b.phone)}` : ''}</p>
                {b.site && <a className="text-xs underline" href={b.site} target="_blank" rel="noreferrer noopener">{b.site.replace(/^https?:\/\//, '')}</a>}
              </div>
              <Button size="sm" variant="outline" onClick={() => void act({ action: 'add', dot: b.dot, name: b.name, kind: 'broker', url: b.site, phone: b.phone, why: `${b.city}, ${b.state} · USDOT ${b.dot}` })}>Track</Button>
            </li>
          ))}</ul>}
      </section>}
    </div>
  );
}

export default function AdminOutreachPage() { return <EmployeeLayout isAdmin><Outreach /></EmployeeLayout>; }
