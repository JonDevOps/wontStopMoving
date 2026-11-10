'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type OutboxMessage = {
  id: string; to: string; subject: string; category: string | null; referenceId: string | null;
  status: 'pending' | 'sending' | 'sent' | 'needs_review' | 'dismissed'; failureCode: string | null;
  createdAt: string | null; attemptedAt: string | null; sentAt: string | null;
};
type Filter = 'attention' | 'sent' | 'all';

const STUCK_SENDING_MS = 10 * 60 * 1000;
const isStuck = (m: OutboxMessage) => m.status === 'sending' && (!m.attemptedAt || Date.parse(m.attemptedAt) < Date.now() - STUCK_SENDING_MS);
const needsAttention = (m: OutboxMessage) => m.status === 'needs_review' || m.status === 'pending' || isStuck(m);

const STATUS_TEXT: Record<OutboxMessage['status'], string> = {
  pending: 'Not sent yet',
  sending: 'Sending',
  sent: 'Sent',
  needs_review: 'Failed — check before retrying',
  dismissed: 'Dismissed',
};
const STATUS_STYLE: Record<OutboxMessage['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  sending: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  needs_review: 'bg-red-100 text-red-800',
  dismissed: 'bg-gray-100 text-gray-700',
};
const when = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

function EmailOutbox() {
  const auth = useAuth();
  const [messages, setMessages] = useState<OutboxMessage[]>([]);
  const [configured, setConfigured] = useState(true);
  const [filter, setFilter] = useState<Filter>('attention');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ configured: boolean; messages: OutboxMessage[] }>(auth, '/api/admin/notifications');
      setMessages(result.messages); setConfigured(result.configured);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load emails.'); }
    finally { setLoading(false); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  async function act(message: OutboxMessage, kind: 'retry' | 'dismiss') {
    setBusy(message.id); setNotice('');
    try {
      const { status } = await apiFetch<{ status: string }>(auth, '/api/admin/notifications', { kind, id: message.id });
      setNotice(kind === 'dismiss' ? `Dismissed the email to ${message.to}.`
        : status === 'sent' ? `Sent the email to ${message.to}.`
        : status === 'pending_configuration' ? 'Email sending is not set up on the server, so the email is still waiting.'
        : `The email to ${message.to} failed again. Check the address and try later.`);
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'That action failed.'); }
    finally { setBusy(null); }
  }

  const attention = messages.filter(needsAttention);
  const shown = filter === 'attention' ? attention : filter === 'sent' ? messages.filter(m => m.status === 'sent') : messages;

  return <div className="space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Emails</h1>
      <p className="text-muted-foreground">Automatic emails from noreply@wontstopmoving.com for bookings, quotes and approvals. Shows the latest 100.</p>
    </div>
    {!configured && <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900">Email sending isn’t set up on the server (the Zoho login or password is missing), so new emails wait here until it is.</p>}
    <p className="rounded-xl bg-gray-50 border p-4 text-sm">A failed send is held instead of retried automatically, because the customer may have received it anyway. Check with them first if it matters, then retry or dismiss.</p>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter emails">
      {([['attention', `Needs attention (${attention.length})`], ['sent', 'Sent'], ['all', 'All']] as [Filter, string][]).map(([value, label]) =>
        <Button key={value} role="tab" aria-selected={filter === value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>)}
      <Button variant="ghost" onClick={() => void load()} disabled={loading}>Refresh</Button>
    </div>
    {notice && <p role="status" className="font-medium">{notice}</p>}
    {loading ? <p>Loading emails…</p> : shown.length === 0 ? <p>{filter === 'attention' ? 'Nothing needs attention. Every email has been sent or dismissed.' : 'No emails yet.'}</p> :
      <div className="space-y-3">{shown.map(m => {
        const canAct = needsAttention(m) || m.status === 'dismissed';
        return <Card key={m.id} className="bg-white"><CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="font-bold break-all">{m.subject}</p>
            <span className={`text-xs font-bold px-2 py-1 rounded ${STATUS_STYLE[m.status]}`}>{isStuck(m) ? 'Interrupted while sending' : STATUS_TEXT[m.status]}</span>
          </div>
          <p className="text-sm break-all">To: {m.to}{m.category ? ` · ${m.category}` : ''}</p>
          <p className="text-xs text-muted-foreground">Created {when(m.createdAt)} · Last attempt {when(m.attemptedAt)}{m.sentAt ? ` · Sent ${when(m.sentAt)}` : ''}{m.failureCode ? ` · ${m.failureCode}` : ''}</p>
          {canAct && <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={busy === m.id || !configured} onClick={() => void act(m, 'retry')}>{busy === m.id ? 'Working…' : 'Retry send'}</Button>
            {m.status !== 'dismissed' && <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => void act(m, 'dismiss')}>Dismiss</Button>}
          </div>}
        </CardContent></Card>;
      })}</div>}
  </div>;
}

export default function AdminEmailsPage() { return <EmployeeLayout isAdmin><EmailOutbox /></EmployeeLayout>; }
