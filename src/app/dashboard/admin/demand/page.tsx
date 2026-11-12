'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Signal = { id: string; title: string; link: string; text: string; published: string | null; phrases: string[]; places: string[]; score: number; status: string; foundAt: string | null };
type Data = { feeds: { url: string; status: string }[]; places: string[]; signals: Signal[] };
const STATUSES = ['new', 'contacted', 'won', 'ignored'];

function Demand() {
  const auth = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [feeds, setFeeds] = useState('');
  const [places, setPlaces] = useState('');
  const [filter, setFilter] = useState('new');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const d = await apiFetch<Data>(auth, '/api/admin/demand');
      setData(d); setFeeds(d.feeds.map(f => f.url).join('\n')); setPlaces(d.places.join(', '));
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not load.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  const act = async (body: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    try { const r = await apiFetch<{ found?: number }>(auth, '/api/admin/demand', body); setNotice(msg ?? (typeof r.found === 'number' ? `Checked feeds: ${r.found} new posts.` : 'Saved.')); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(false); }
  };
  const shown = (data?.signals || []).filter(s => filter === 'all' || s.status === filter).sort((a, b) => b.score - a.score);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-black text-primary uppercase">Demand monitor</h1>
        <p className="text-muted-foreground">Posts from people looking for movers, found hourly in the feeds below. Reply from your own account where the site allows it. We never scrape sites whose terms forbid it (Craigslist feeds are refused).</p>
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <section className="bg-white rounded-xl p-4 space-y-3">
        <p className="font-bold">Feeds and places</p>
        <p className="text-xs text-muted-foreground">One RSS or Atom feed per line. Good sources: Google Alerts set to “Deliver to: RSS feed” for phrases like <i>“need movers” San Jose</i>, local news, and forums that publish feeds. Places rank posts that mention them higher.</p>
        <Textarea aria-label="Feeds" rows={4} value={feeds} onChange={e => setFeeds(e.target.value)} placeholder="https://www.google.com/alerts/feeds/…" />
        <Input aria-label="Places" value={places} onChange={e => setPlaces(e.target.value)} placeholder="San Francisco, Oakland, San Jose, Seattle" />
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void act({ action: 'settings', feeds: feeds.split(/\s+/).filter(Boolean), places }, 'Saved.')}>Save</Button>
          <Button variant="outline" disabled={busy || !data?.feeds.length} onClick={() => void act({ action: 'run' })}>Check feeds now</Button>
        </div>
        {data && data.feeds.length > 0 && <ul className="text-xs space-y-1">{data.feeds.map(f => <li key={f.url} className="truncate"><span className={f.status.startsWith('error') ? 'text-red-600' : 'text-green-700'}>●</span> {f.url} <span className="text-muted-foreground">· {f.status}</span></li>)}</ul>}
      </section>
      <div className="flex flex-wrap gap-2">{['new', 'contacted', 'won', 'ignored', 'all'].map(s => <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>{s} ({s === 'all' ? data?.signals.length ?? 0 : (data?.signals || []).filter(x => x.status === s).length})</Button>)}</div>
      {!data ? <p>Loading…</p> : !shown.length ? <p className="text-muted-foreground">Nothing here yet.</p> : (
        <ul className="space-y-3">{shown.map(s => (
          <li key={s.id} className="bg-white rounded-xl p-4 space-y-1">
            <div className="flex justify-between gap-2 flex-wrap">
              <a className="font-bold underline" href={s.link} target="_blank" rel="noreferrer noopener">{s.title || s.link}</a>
              <Badge variant="outline">score {s.score}</Badge>
            </div>
            <p className="text-sm text-slate-700 line-clamp-3">{s.text}</p>
            <p className="text-xs text-muted-foreground">{s.phrases.join(', ')}{s.places.length ? ` · ${s.places.join(', ')}` : ''}{s.published ? ` · posted ${new Date(s.published).toLocaleDateString()}` : ''}</p>
            <div className="flex gap-2 pt-1">{STATUSES.filter(x => x !== s.status).map(x => <Button key={x} size="sm" variant="outline" disabled={busy} onClick={() => void act({ action: 'status', id: s.id, status: x }, `Marked ${x}.`)}>{x}</Button>)}</div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

export default function AdminDemandPage() { return <EmployeeLayout isAdmin><Demand /></EmployeeLayout>; }
