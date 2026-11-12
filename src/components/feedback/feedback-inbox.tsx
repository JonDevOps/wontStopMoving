'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

type Item = { id: string; role: string; name: string; email: string; type: string; message: string; page: string; status: string; reply?: string; repliedBy?: string; createdAt: string | null; repliedAt: string | null };
const STATUS: Record<string, string> = { new: 'New', reviewing: 'Reviewing', planned: 'Planned', done: 'Done', 'wont-do': 'Won’t do' };
const TYPE: Record<string, string> = { idea: 'Idea', problem: 'Problem', praise: 'Praise', other: 'Other' };

/** Feedback from customers, providers, agents and staff, for admins and employees. */
export function FeedbackInbox() {
  const auth = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [show, setShow] = useState('open');
  const [role, setRole] = useState('');
  const load = useCallback(() => apiFetch<{ items: Item[] }>(auth, '/api/app-feedback').then(r => setItems(r.items)).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load feedback', description: e instanceof Error ? e.message : '' })), [auth, toast]);
  useEffect(() => { void load(); }, [load]);
  const update = async (id: string, body: Record<string, unknown>, ok: string) => {
    try { await apiFetch(auth, '/api/app-feedback', { action: 'update', id, ...body }); toast({ title: ok }); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  const shown = (items || []).filter(i => (show === 'all' || (show === 'open' ? ['new', 'reviewing', 'planned'].includes(i.status) : i.status === show)) && (!role || i.role === role));
  return <div className="space-y-6 max-w-4xl mx-auto">
    <div className="space-y-2"><h1 className="text-3xl font-bold">Feedback</h1><p className="text-muted-foreground">Ideas, problems and praise from customers, providers, agents and the team. Replies are emailed to the sender.</p></div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Status" className="h-10 border rounded-md px-2 bg-white text-sm" value={show} onChange={e => setShow(e.target.value)}><option value="open">Open</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="all">All</option></select>
      <select aria-label="From" className="h-10 border rounded-md px-2 bg-white text-sm" value={role} onChange={e => setRole(e.target.value)}><option value="">Everyone</option>{['customer', 'provider', 'agent', 'employee', 'admin'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}s</option>)}</select>
    </div>
    {!items ? <p>Loading…</p> : !shown.length ? <p className="text-muted-foreground">Nothing here.</p> : shown.map(i => <Card key={i.id} className="bg-white"><CardContent className="p-5 space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <p><Badge variant="outline" className="mr-2">{TYPE[i.type] || i.type}</Badge><b>{i.name || i.email}</b> <span className="text-muted-foreground">({i.role}) · {i.createdAt ? new Date(i.createdAt).toLocaleString() : ''}{i.page ? ` · from ${i.page}` : ''}</span></p>
        <select aria-label="Status" className="h-9 border rounded-md px-2 bg-white" value={i.status} onChange={e => void update(i.id, { status: e.target.value }, 'Status updated')}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <p className="whitespace-pre-wrap">{i.message}</p>
      {i.reply ? <p className="bg-slate-50 rounded-lg p-3"><b>Reply from {i.repliedBy}</b>{i.repliedAt ? ` · ${new Date(i.repliedAt).toLocaleDateString()}` : ''}<br />{i.reply}</p>
        : <form className="space-y-2" onSubmit={e => { e.preventDefault(); const reply = String(new FormData(e.currentTarget).get('reply') || ''); if (reply.trim()) void update(i.id, { reply }, 'Reply sent'); }}><Textarea name="reply" rows={2} placeholder={`Reply to ${i.name || 'them'} (emailed)`} /><Button size="sm" variant="outline" type="submit">Send reply</Button></form>}
    </CardContent></Card>)}
  </div>;
}
