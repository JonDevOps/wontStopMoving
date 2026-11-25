'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { Pin, PinOff, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';

type Note = { id: string; text: string; authorId: string; authorName: string; pinned: boolean; resolved: boolean; topic: string; createdAt: string | null; updatedAt: string | null; updatedByName: string | null };

/** Admin-only notes board shared between admins (#133). */
export function AdminNotes() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    try { setNotes((await apiFetch<{ notes: Note[] }>(auth, '/api/admin/notes')).notes); }
    catch (e) { setNotes([]); toast({ variant: 'destructive', title: 'Could not load notes', description: e instanceof Error ? e.message : '' }); }
  }, [auth, toast]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try { await apiFetch(auth, '/api/admin/notes', body); if (body.action === 'create') { setText(''); setTopic(''); } await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(null); }
  }

  const shown = useMemo(() => (notes || [])
    .filter(n => showResolved || !n.resolved)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.createdAt || '').localeCompare(a.createdAt || '')), [notes, showResolved]);
  const resolvedCount = (notes || []).filter(n => n.resolved).length;

  return <section className="space-y-4">
    <div>
      <h2 className="text-2xl font-bold">Admin notes</h2>
      <p className="text-sm text-muted-foreground">Only admins can see these. Leave context, decisions and to-dos for each other; pin what everyone should read.</p>
    </div>
    <Card className="bg-white"><CardContent className="p-4 space-y-2">
      <Input aria-label="Topic" placeholder="Topic (optional), e.g. Pricing, Twilio, Hiring" maxLength={60} value={topic} onChange={e => setTopic(e.target.value)} />
      <Textarea aria-label="New note" placeholder="Write a note for the other admins…" maxLength={4000} value={text} onChange={e => setText(e.target.value)} />
      <Button disabled={busy === 'create' || !text.trim()} onClick={() => void act({ action: 'create', text, topic }, 'create')}>{busy === 'create' ? 'Posting…' : 'Post note'}</Button>
    </CardContent></Card>
    {resolvedCount > 0 && <Button variant="ghost" size="sm" onClick={() => setShowResolved(v => !v)}>{showResolved ? 'Hide' : 'Show'} resolved ({resolvedCount})</Button>}
    {notes === null ? <p>Loading notes…</p> : shown.length === 0 ? <p className="text-muted-foreground">No notes yet.</p> :
      <div className="space-y-3">{shown.map(n => <Card key={n.id} className={`bg-white ${n.pinned ? 'border-accent' : ''} ${n.resolved ? 'opacity-60' : ''}`}><CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {n.pinned && <Badge className="bg-accent">Pinned</Badge>}
          {n.resolved && <Badge variant="secondary">Resolved</Badge>}
          {n.topic && <Badge variant="outline">{n.topic}</Badge>}
          <span className="text-xs text-muted-foreground">{n.authorName}{n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString()}` : ''}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{n.text}</p>
        {n.updatedByName && n.updatedAt && <p className="text-xs text-muted-foreground">Last changed by {n.updatedByName} · {new Date(n.updatedAt).toLocaleString()}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy === n.id} onClick={() => void act({ action: 'pin', id: n.id, value: !n.pinned }, n.id)}>{n.pinned ? <><PinOff className="h-3.5 w-3.5 mr-1" />Unpin</> : <><Pin className="h-3.5 w-3.5 mr-1" />Pin</>}</Button>
          <Button size="sm" variant="outline" disabled={busy === n.id} onClick={() => void act({ action: 'resolve', id: n.id, value: !n.resolved }, n.id)}>{n.resolved ? <><RotateCcw className="h-3.5 w-3.5 mr-1" />Reopen</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Resolve</>}</Button>
          {user?.uid === n.authorId && <Button size="sm" variant="ghost" className="text-red-600" disabled={busy === n.id} onClick={() => { if (confirm('Delete this note? This can’t be undone.')) void act({ action: 'delete', id: n.id }, n.id); }}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>}
        </div>
      </CardContent></Card>)}</div>}
  </section>;
}
