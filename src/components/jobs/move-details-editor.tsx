'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { MOVE_DETAIL_LABELS, MOVE_SIZES, type MoveChange } from '@/lib/move-details';

type Change = { id: string; changes: MoveChange[]; by: string; reason: string; at: string | null };
type Job = Record<string, any>;

const toForm = (job: Job) => ({
  moveDate: typeof job.moveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(job.moveDate) ? job.moveDate : '',
  moveTime: job.moveTime || '', pickupAddress: job.pickupAddress || '', dropoffAddress: job.dropoffAddress || '',
  moveSize: job.moveSize && job.moveSize in MOVE_SIZES ? job.moveSize : 'studio', hoursReserved: job.hoursReserved ? String(job.hoursReserved) : '',
  specialItems: job.specialItems || '', accessNotes: job.accessNotes || '',
});

/** Edit a booked move's details (admins, or crew assigned to the move), with a change history. */
export function MoveDetailsEditor({ jobId, job, onSaved }: { jobId: string; job: Job; onSaved?: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(job));
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Change[] | null>(null);
  const locked = ['completed', 'cancelled'].includes(job.status);

  const loadHistory = useCallback(() => apiFetch<{ changes: Change[] }>(auth, `/api/jobs/${jobId}/details`).then(r => setHistory(r.changes)).catch(() => setHistory([])), [auth, jobId]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => { if (!editing) setForm(toForm(job)); }, [job, editing]);

  const set = (k: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await apiFetch<{ changed: number; emailed: boolean }>(auth, `/api/jobs/${jobId}/details`, { details: { ...form, hoursReserved: form.hoursReserved || null }, reason, notifyCustomer: notify });
      toast({ title: r.changed ? 'Move updated' : 'Nothing changed', description: r.changed ? `${r.changed} detail${r.changed === 1 ? '' : 's'} saved${r.emailed ? ' and the customer was emailed' : ''}.` : 'The details already match.' });
      if (r.changed) { setEditing(false); setReason(''); onSaved?.(); void loadHistory(); }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally { setBusy(false); }
  };

  const field = (k: keyof ReturnType<typeof toForm>, input: React.ReactNode) =>
    <label className="space-y-1 text-sm block"><span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{MOVE_DETAIL_LABELS[k]}</span>{input}</label>;

  return <Card className="border-none shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Move details</CardTitle>
      {!editing && !locked && <Button size="sm" onClick={() => setEditing(true)}>Edit details</Button>}
    </CardHeader>
    <CardContent className="space-y-6">
      {locked && <p className="text-sm text-muted-foreground">This move is {job.status}, so its details are locked.</p>}
      {editing ? <form onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {field('moveDate', <Input type="date" required value={form.moveDate} onChange={set('moveDate')} />)}
          {field('moveTime', <Input placeholder="e.g. 8–10 AM" value={form.moveTime} onChange={set('moveTime')} />)}
          {field('pickupAddress', <Input required value={form.pickupAddress} onChange={set('pickupAddress')} />)}
          {field('dropoffAddress', <Input required value={form.dropoffAddress} onChange={set('dropoffAddress')} />)}
          {field('moveSize', <select className="w-full h-10 border rounded-md px-3 bg-white" value={form.moveSize} onChange={set('moveSize')}>{Object.entries(MOVE_SIZES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {field('hoursReserved', <Input type="number" min="0.5" max="72" step="0.5" value={form.hoursReserved} onChange={set('hoursReserved')} />)}
        </div>
        {field('specialItems', <Textarea rows={2} value={form.specialItems} onChange={set('specialItems')} />)}
        {field('accessNotes', <Textarea rows={2} value={form.accessNotes} onChange={set('accessNotes')} placeholder="Stairs, elevator booking, parking, gate codes…" />)}
        <label className="space-y-1 text-sm block"><span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Reason for the change (internal)</span><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer called to move the date" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Email the customer if the date, arrival window, addresses or hours change</label>
        <p className="text-xs text-muted-foreground">Changing details doesn’t change the price. If the move got bigger or smaller, send the customer a new custom quote for the difference.</p>
        <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div>
      </form> : !locked && <p className="text-sm text-muted-foreground">Update the date, arrival window, addresses, size, hours or access notes. Changes are logged below.</p>}

      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1"><History className="h-3.5 w-3.5" /> Change history</p>
        {history === null ? <p className="text-sm text-muted-foreground">Loading…</p> : !history.length ? <p className="text-sm text-muted-foreground">No changes since booking.</p> :
          <ul className="space-y-3">{history.map(h => <li key={h.id} className="text-sm border-l-2 border-accent/40 pl-3">
            <p className="text-xs text-muted-foreground">{h.at ? new Date(h.at).toLocaleString() : ''} · {h.by}{h.reason ? ` · ${h.reason}` : ''}</p>
            {h.changes.map(c => <p key={c.field}><span className="font-medium">{c.label}:</span> <span className="line-through text-muted-foreground">{c.from}</span> → {c.to}</p>)}
          </li>)}</ul>}
      </div>
    </CardContent>
  </Card>;
}
