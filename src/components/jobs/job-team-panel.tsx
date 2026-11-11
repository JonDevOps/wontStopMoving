'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { AGENT_JOB_ROLES, ASSIGNEE_LABELS, mapLink, STAGES, type AgentJobRole, type AssigneeKind, type Location, type Stage } from '@/lib/job-activity';

type Member = { kind: AssigneeKind; id: string; agentRole?: AgentJobRole; name: string; base: string; assignedAt: string | null; assignedBy: string | null; assignNote: string; response: string | null; latest: { stage: Stage; note: string; at: string | null; location: Location | null } | null };
type Entry = { id: string; type: 'assigned' | 'unassigned' | 'update'; assigneeKind?: AssigneeKind; assigneeName?: string; agentRole?: AgentJobRole | null; base?: string; stage?: Stage; note?: string; location?: Location | null; by: string; byRole: string; at: string | null };
type Option = { id: string; name: string; base: string };
type Data = { team: Member[]; activity: Entry[]; options?: Record<AssigneeKind, Option[]>; status: string };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const roleLabel = (m: { kind?: AssigneeKind; agentRole?: AgentJobRole | null }) => m.kind === 'agent' && m.agentRole ? AGENT_JOB_ROLES[m.agentRole] : m.kind ? ASSIGNEE_LABELS[m.kind] : '';

/**
 * The people working a move and everything they've reported.
 * Admins assign and remove people; anyone on the team posts updates.
 */
export function JobTeamPanel({ jobId, admin = false, refreshKey }: { jobId: string; admin?: boolean; refreshKey?: unknown }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => apiFetch<Data>(auth, `/api/jobs/${jobId}/assignments`).then(d => { setData(d); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Could not load the team.')), [auth, jobId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await apiFetch(auth, `/api/jobs/${jobId}/assignments`, body); toast({ title: ok }); await load(); return true; }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : 'Please try again.' }); return false; }
    finally { setBusy(false); }
  };

  const locked = ['completed', 'cancelled'].includes(data?.status || '');
  return <Card className="border-none shadow-sm">
    <CardHeader><CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Team & activity</CardTitle></CardHeader>
    <CardContent className="space-y-8">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data ? !error && <p className="text-sm text-muted-foreground">Loading…</p> : <>
        <TeamList team={data.team} admin={admin && !busy} onRemove={m => { if (confirm(`Remove ${m.name} from this move?`)) void post({ action: 'unassign', kind: m.kind, assigneeId: m.id, agentRole: m.agentRole }, `${m.name} removed`); }} />
        {admin && data.options && !locked && <AssignForm options={data.options} busy={busy} onAssign={(b, name) => post({ action: 'assign', ...b }, `${name} assigned`)} />}
        {!locked && <UpdateForm busy={busy} onPost={b => post({ action: 'update', ...b }, 'Update posted')} />}
        <Timeline activity={data.activity} />
      </>}
    </CardContent>
  </Card>;
}

function TeamList({ team, admin, onRemove }: { team: Member[]; admin: boolean; onRemove: (m: Member) => void }) {
  if (!team.length) return <p className="text-sm text-muted-foreground">Nobody is assigned yet.</p>;
  return <ul className="space-y-3">
    {team.map(m => <li key={`${m.kind}:${m.id}:${m.agentRole || ''}`} className="border rounded-xl p-3 bg-white flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1 text-sm">
        <p className="font-bold text-primary">{m.name} <Badge variant="outline" className="ml-1 text-[10px]">{roleLabel(m)}</Badge>{m.response && <Badge className="ml-1 text-[10px] capitalize" variant={m.response === 'accepted' ? 'default' : 'outline'}>{m.response === 'pending' ? 'awaiting reply' : m.response}</Badge>}</p>
        <p className="text-xs text-muted-foreground">{m.base ? `Based in ${m.base} · ` : ''}{m.assignedAt ? `Assigned ${when(m.assignedAt)}${m.assignedBy ? ` by ${m.assignedBy}` : ''}` : 'Assigned before history was kept'}</p>
        {m.assignNote && <p className="text-xs">Note: {m.assignNote}</p>}
        {m.latest && <p className="text-xs"><span className="font-semibold">Latest:</span> {STAGES[m.latest.stage] || 'Note'}{m.latest.note ? `: ${m.latest.note}` : ''} · {when(m.latest.at)}{m.latest.location && <> · <a className="underline" href={mapLink(m.latest.location)} target="_blank" rel="noreferrer noopener">map</a></>}</p>}
      </div>
      {admin && <Button size="sm" variant="outline" onClick={() => onRemove(m)}>Remove</Button>}
    </li>)}
  </ul>;
}

function AssignForm({ options, busy, onAssign }: { options: Record<AssigneeKind, Option[]>; busy: boolean; onAssign: (body: Record<string, unknown>, name: string) => Promise<boolean> }) {
  const [kind, setKind] = useState<AssigneeKind>('provider');
  const [assigneeId, setAssigneeId] = useState('');
  const [agentRole, setAgentRole] = useState<AgentJobRole>('origin');
  const [note, setNote] = useState('');
  const list = options[kind] || [];
  return <form className="space-y-3 bg-gray-50 rounded-xl p-4" onSubmit={async e => {
    e.preventDefault();
    const person = list.find(o => o.id === assigneeId);
    if (!person) return;
    if (await onAssign({ kind, assigneeId, agentRole: kind === 'agent' ? agentRole : undefined, note }, person.name)) { setAssigneeId(''); setNote(''); }
  }}>
    <p className="text-sm font-bold">Assign someone</p>
    <div className="grid sm:grid-cols-3 gap-2">
      <select aria-label="Type" className="h-10 border rounded-md px-2 bg-white text-sm" value={kind} onChange={e => { setKind(e.target.value as AssigneeKind); setAssigneeId(''); }}>
        {(Object.keys(ASSIGNEE_LABELS) as AssigneeKind[]).map(k => <option key={k} value={k}>{ASSIGNEE_LABELS[k]}</option>)}
      </select>
      <select aria-label="Person" required className="h-10 border rounded-md px-2 bg-white text-sm sm:col-span-2" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
        <option value="">{list.length ? 'Choose…' : ({ provider: 'No approved movers yet', employee: 'No crew members yet', agent: 'No approved agents yet' } as const)[kind]}</option>
        {list.map(o => <option key={o.id} value={o.id}>{o.name}{o.base ? ` (${o.base})` : ''}</option>)}
      </select>
      {kind === 'agent' && <select aria-label="Agent role" className="h-10 border rounded-md px-2 bg-white text-sm" value={agentRole} onChange={e => setAgentRole(e.target.value as AgentJobRole)}>
        {(Object.keys(AGENT_JOB_ROLES) as AgentJobRole[]).map(r => <option key={r} value={r}>{AGENT_JOB_ROLES[r]}</option>)}
      </select>}
      <Input className={kind === 'agent' ? 'sm:col-span-2' : 'sm:col-span-3'} placeholder="Note for them (optional): arrival time, gate code, what to bring…" value={note} onChange={e => setNote(e.target.value)} />
    </div>
    <Button type="submit" size="sm" disabled={busy || !assigneeId}>Assign</Button>
    <p className="text-xs text-muted-foreground">They’re emailed the job. Agents accept or decline from their dashboard.</p>
  </form>;
}

function UpdateForm({ busy, onPost }: { busy: boolean; onPost: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [stage, setStage] = useState<Stage>('note');
  const [note, setNote] = useState('');
  const [share, setShare] = useState(false);
  const [locating, setLocating] = useState(false);
  const locate = () => new Promise<Location | null>(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault();
    let location: Location | null = null;
    if (share) { setLocating(true); location = await locate(); setLocating(false); }
    if (await onPost({ stage, note, location })) { setNote(''); setStage('note'); }
  }}>
    <p className="text-sm font-bold">Post an update</p>
    <div className="grid sm:grid-cols-3 gap-2">
      <select aria-label="Stage" className="h-10 border rounded-md px-2 bg-white text-sm" value={stage} onChange={e => setStage(e.target.value as Stage)}>
        {(Object.keys(STAGES) as Stage[]).map(s => <option key={s} value={s}>{STAGES[s]}</option>)}
      </select>
      <Textarea rows={1} className="sm:col-span-2 min-h-10" placeholder="What’s happening? (optional with a stage)" value={note} onChange={e => setNote(e.target.value)} />
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} />Include my current location</label>
    <Button type="submit" size="sm" variant="outline" disabled={busy || locating}>{locating ? 'Getting location…' : 'Post update'}</Button>
  </form>;
}

function Timeline({ activity }: { activity: Entry[] }) {
  const [all, setAll] = useState(false);
  const shown = useMemo(() => (all ? activity : activity.slice(0, 12)), [activity, all]);
  return <div className="space-y-3">
    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1"><History className="h-3.5 w-3.5" /> History</p>
    {!activity.length ? <p className="text-sm text-muted-foreground">No activity yet.</p> : <ul className="space-y-3">
      {shown.map(e => <li key={e.id} className={`text-sm border-l-2 pl-3 ${e.type === 'update' ? (e.stage === 'issue' ? 'border-red-400' : 'border-accent/50') : 'border-slate-300'}`}>
        <p className="text-xs text-muted-foreground">{when(e.at)}</p>
        <p>
          {e.type === 'assigned' && <><span className="font-semibold">{e.by}</span> assigned <span className="font-semibold">{e.assigneeName}</span> as {roleLabel({ kind: e.assigneeKind, agentRole: e.agentRole })}{e.base ? ` (based in ${e.base})` : ''}</>}
          {e.type === 'unassigned' && <><span className="font-semibold">{e.by}</span> removed <span className="font-semibold">{e.assigneeName}</span> ({roleLabel({ kind: e.assigneeKind, agentRole: e.agentRole })})</>}
          {e.type === 'update' && <><span className="font-semibold">{e.by}</span>{e.assigneeKind ? ` (${roleLabel({ kind: e.assigneeKind })})` : ' (office)'}: {e.stage && e.stage !== 'note' ? <span className="font-semibold">{STAGES[e.stage]}</span> : 'note'}</>}
        </p>
        {e.note && <p className="whitespace-pre-wrap">{e.note}</p>}
        {e.location && <a className="text-xs underline inline-flex items-center gap-1" href={mapLink(e.location)} target="_blank" rel="noreferrer noopener"><MapPin className="h-3 w-3" />Location{e.location.accuracy ? ` (±${e.location.accuracy} m)` : ''}</a>}
      </li>)}
    </ul>}
    {activity.length > 12 && <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${activity.length}`}</Button>}
  </div>;
}
