'use client';

import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

type Network = { kind: 'agent' | 'provider'; id: string; name: string; phone: string; trucks: number | null; free: number | null; miles: number };
type Licensed = { dot: string; name: string; dba: string; city: string; state: string; phone: string; email: string; site: string; units: number; drivers: number; years: number; hhgAuth: boolean; miles: number };
type Data = { zip: string; center: [number, number] | null; network: Network[]; registry: Licensed[]; routing: { primary: { kind: string; name: string; miles: number } | null; backup: { kind: string; name: string; miles: number } | null; autoAssigned: boolean; computedAt: string | null } | null };
const nice = (s: string) => (s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());

/** Who can cover this move: auto-routing's pick, our nearest partners, and licensed movers nearby to bring in as agents. */
export function OverflowPartners({ jobId }: { jobId: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [miles, setMiles] = useState(25);
  const [busy, setBusy] = useState(false);
  const load = async (m = miles) => {
    setBusy(true);
    try { setData(await apiFetch<Data>(auth, `/api/jobs/${jobId}/overflow?miles=${m}`)); }
    catch (e) { toast({ variant: 'destructive', title: 'Couldn’t load partners', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };
  const invite = async (m: Licensed) => {
    try { await apiFetch(auth, '/api/admin/agents', { action: 'prospect-add-many', movers: [{ dot: m.dot, state: m.state }], source: 'overflow', note: `Overflow partner for job ${jobId}.` }); toast({ title: `${nice(m.dba || m.name)} added to agent recruiting`, description: 'Call them, then assign them on this job once approved.' }); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  return <Card className="border-none shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-accent" /> Routing & overflow partners</CardTitle>
      <div className="flex gap-2 items-center"><select aria-label="Distance" className="h-9 border rounded-md px-2 bg-white text-sm" value={miles} onChange={e => { setMiles(Number(e.target.value)); if (data) void load(Number(e.target.value)); }}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} miles</option>)}</select><Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>{busy ? 'Looking…' : data ? 'Refresh' : 'Find who can cover this'}</Button></div>
    </CardHeader>
    {data && <CardContent className="space-y-5 text-sm">
      {data.routing && <p className="bg-slate-50 rounded-lg p-3">Auto-routing{data.routing.autoAssigned ? ' assigned' : ' suggested'}: <b>{data.routing.primary ? `${data.routing.primary.name} (${data.routing.primary.kind}, ${data.routing.primary.miles} mi)` : 'nobody in range'}</b>{data.routing.backup ? `; backup ${data.routing.backup.name} (${data.routing.backup.miles} mi)` : ''}.</p>}
      {!data.center ? <p className="text-muted-foreground">No pickup ZIP code on this move, so distances can’t be worked out.</p> : <>
        <div className="space-y-2"><p className="font-bold">Our partners nearby (pickup {data.zip})</p>
          {data.network.length ? data.network.map(n => <div key={`${n.kind}:${n.id}`} className="flex justify-between gap-2 border-b last:border-0 pb-2"><span><b>{n.name}</b> <span className="text-muted-foreground">({n.kind}) · {n.miles} mi{n.free !== null ? ` · ${n.free} trucks free this week` : ''}</span></span>{n.phone && <a className="underline" href={`tel:${n.phone}`}>{n.phone}</a>}</div>)
            : <p className="text-muted-foreground">No approved partners nearby.</p>}
          <p className="text-xs text-muted-foreground">Assign them in Team & activity below.</p>
        </div>
        <div className="space-y-2"><p className="font-bold">Licensed movers within {miles} miles</p>
          {data.registry.length ? data.registry.map(m => <div key={m.dot} className="flex flex-wrap justify-between gap-2 border-b last:border-0 pb-2">
            <span><b>{nice(m.dba || m.name)}</b> <span className="text-muted-foreground">{nice(m.city)} · {m.miles} mi · {m.units} trucks · {m.years} yrs{m.hhgAuth ? ' · interstate' : ''}</span>{m.site && <><br /><a className="text-xs underline" href={m.site} target="_blank" rel="noreferrer noopener">{m.site.replace(/^https?:\/\//, '')}</a></>}</span>
            <span className="flex gap-2 items-center">{m.phone && <a className="underline" href={`tel:${m.phone}`}>{m.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</a>}<Button size="sm" variant="outline" onClick={() => void invite(m)}>Recruit</Button></span>
          </div>) : <p className="text-muted-foreground">None found. Try a wider distance.</p>}
          <p className="text-xs text-muted-foreground">Call them to cover this job. “Recruit” adds them to the agent pipeline; once vetted and approved you can assign them here.</p>
        </div>
      </>}
    </CardContent>}
  </Card>;
}
