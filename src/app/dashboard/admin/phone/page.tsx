'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { PhoneIncoming, PhoneMissed, ShieldOff, MessageSquare, PhoneCall } from 'lucide-react';

type Item = { id: string; kind: string; phone: string; body: string; mediaCount: number; status: string; choice: string | null; knownName: string | null; knownRole: string | null; callerName: string | null; queueSeconds: number | null; blocked: boolean; createdAt: string | null; answeredAt: string | null };
const STATUS: Record<string, { label: string; tone: string }> = {
  answered: { label: 'Answered', tone: 'bg-green-100 text-green-800' },
  ringing: { label: 'Ringing', tone: 'bg-blue-100 text-blue-800' },
  menu: { label: 'In menu', tone: 'bg-slate-100 text-slate-700' },
  missed: { label: 'Missed: call back', tone: 'bg-red-100 text-red-800' },
  caller_hung_up: { label: 'Hung up on hold: call back', tone: 'bg-amber-100 text-amber-800' },
  likely_spam: { label: 'No key pressed (likely spam)', tone: 'bg-slate-100 text-slate-500' },
  blocked: { label: 'Blocked', tone: 'bg-slate-200 text-slate-600' },
};
const CHOICE: Record<string, string> = { booking: 'Book a move', dispatch: 'Provider dispatch', support: 'Customer support' };
const pretty = (p: string) => { const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || 'Unknown'; };

/** Business phone call log and text inbox (#159, #182). */
export default function AdminPhonePage() {
  const auth = useAuth();
  const [items, setItems] = useState<Item[]>([]), [error, setError] = useState(''), [filter, setFilter] = useState<'all' | 'callback' | 'calls' | 'texts' | 'spam'>('callback'), [busy, setBusy] = useState('');
  const load = useCallback(async () => { try { setItems((await apiFetch<{ items: Item[] }>(auth, '/api/admin/phone')).items); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the phone log.'); } }, [auth]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30000); return () => clearInterval(t); }, [load]);
  const needsCallback = (i: Item) => i.kind === 'call' && (i.status === 'missed' || i.status === 'caller_hung_up');
  const shown = useMemo(() => items.filter(i => filter === 'all' || (filter === 'callback' ? needsCallback(i) : filter === 'calls' ? i.kind === 'call' && i.status !== 'likely_spam' : filter === 'texts' ? i.kind === 'sms' : i.status === 'likely_spam' || i.status === 'blocked')), [items, filter]);
  async function block(item: Item, action: 'block' | 'unblock') {
    if (action === 'block' && !confirm(`Block ${pretty(item.phone)}? Their calls will be rejected.`)) return;
    setBusy(item.id); try { await apiFetch(auth, '/api/admin/phone', { action, phone: item.phone }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work.'); } finally { setBusy(''); }
  }
  const count = (f: typeof filter) => items.filter(i => f === 'all' || (f === 'callback' ? needsCallback(i) : f === 'calls' ? i.kind === 'call' && i.status !== 'likely_spam' : f === 'texts' ? i.kind === 'sms' : i.status === 'likely_spam' || i.status === 'blocked')).length;
  return <EmployeeLayout isAdmin><main className="space-y-5 max-w-4xl">
    <h1 className="text-3xl font-bold">Business phone</h1>
    <p className="text-sm text-muted-foreground">Calls and texts to {'1-888-741-MOVE'}, newest first. Missed calls and callers who hung up on hold show under Call back. Refreshes every 30 seconds.</p>
    <div className="flex flex-wrap gap-2">{([['callback', 'Call back'], ['calls', 'Calls'], ['texts', 'Texts'], ['spam', 'Spam & blocked'], ['all', 'All']] as const).map(([v, l]) => <Button key={v} size="sm" variant={filter === v ? 'default' : 'outline'} onClick={() => setFilter(v)}>{l} ({count(v)})</Button>)}<Button size="sm" variant="ghost" onClick={() => void load()}>Refresh</Button></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!shown.length && !error && <p className="text-muted-foreground">Nothing here.</p>}
    {shown.map(item => { const st = STATUS[item.status] || { label: item.status, tone: 'bg-slate-100 text-slate-700' }; return <article key={item.id} className={`border rounded-xl bg-white p-4 space-y-2 ${needsCallback(item) ? 'border-red-300' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {item.kind === 'sms' ? <MessageSquare className="h-4 w-4" /> : needsCallback(item) ? <PhoneMissed className="h-4 w-4 text-red-600" /> : <PhoneIncoming className="h-4 w-4" />}
        <h2 className="font-bold">{pretty(item.phone)}</h2>
        {(item.knownName || item.callerName) && <span className="text-sm text-muted-foreground">{item.knownName || item.callerName}{item.knownRole ? ` (${item.knownRole})` : ''}</span>}
        {item.kind === 'call' && <Badge className={`${st.tone} border-none`}>{st.label}</Badge>}
        {item.choice && <Badge variant="outline">{CHOICE[item.choice] || item.choice}</Badge>}
        {item.blocked && <Badge variant="secondary">Blocked</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}{item.queueSeconds ? ` · waited ${item.queueSeconds}s` : ''}{item.kind === 'sms' && item.status ? ` · ${item.status}` : ''}</p>
      {item.body && <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>}
      {item.mediaCount > 0 && <p className="text-sm">Contains {item.mediaCount} media attachment(s). View them securely in Twilio.</p>}
      {item.phone && <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><a href={`tel:${item.phone}`}><PhoneCall className="h-3.5 w-3.5 mr-1" />Call back</a></Button>
        <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void block(item, item.blocked ? 'unblock' : 'block')}><ShieldOff className="h-3.5 w-3.5 mr-1" />{item.blocked ? 'Unblock' : 'Block number'}</Button>
      </div>}
    </article>; })}
  </main></EmployeeLayout>;
}
