'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/firebase';
import type { SupportTicket, SupportStatus } from '@/lib/support';
import { RESPONSE_TARGET_HOURS, SAVED_REPLIES, waitStatus } from '@/lib/service-requests';

function SupportInbox() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [replyChoice, setReplyChoice] = useState<Record<string, string>>({});

  const load = useCallback(async (cursor?: string) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/support${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load enquiries.');
      setTickets(previous => cursor ? [...previous, ...result.tickets] : result.tickets);
      setNextCursor(result.nextCursor);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load enquiries.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(id: string, status: SupportStatus) {
    if (!user) return;
    setSaving(id);
    setError('');
    try {
      const response = await fetch(`/api/admin/support/${id}`, { method: 'PATCH',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update the ticket.');
      setTickets(previous => previous.map(ticket => ticket.id === id ? { ...ticket, status: result.status } : ticket));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update the ticket.'); }
    finally { setSaving(null); }
  }

  return <div className="max-w-5xl mx-auto space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-black text-primary">Support Inbox</h1>
        <p className="text-muted-foreground">Contact enquiries, newest first. Target: first response within {RESPONSE_TARGET_HOURS.support} hours. Reply using your email app; pick a saved reply to start from.</p>
        {tickets.length > 0 && <p className="text-sm font-bold mt-1">{tickets.filter(t => t.status === 'new' && waitStatus(t.createdAt ? Date.parse(t.createdAt) : null, RESPONSE_TARGET_HOURS.support).overdue).length} past target · {tickets.filter(t => t.status !== 'resolved').length} open</p>}</div>
      <Button variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!loading && !error && tickets.length === 0 && <p className="p-8 bg-white rounded-xl">No support enquiries yet.</p>}
    {tickets.map(ticket => <Card key={ticket.id}><CardContent className="p-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0"><h2 className="text-xl font-bold break-words">{ticket.subject}</h2>
          <p className="text-sm text-muted-foreground break-words">{ticket.name} · {ticket.email}{ticket.phone ? ` · ${ticket.phone}` : ''}</p>
          <p className="text-xs text-muted-foreground mt-1">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'Just received'} · Ref: {ticket.id}
            {ticket.status === 'new' && (() => { const w = waitStatus(ticket.createdAt ? Date.parse(ticket.createdAt) : null, RESPONSE_TARGET_HOURS.support); return w.label ? <span className={`ml-2 font-bold ${w.overdue ? 'text-red-700' : 'text-amber-700'}`}>waiting {w.label}{w.overdue ? ' · past target' : ''}</span> : null; })()}
            {ticket.satisfaction ? <span className="ml-2 font-bold">Rated {ticket.satisfaction}/5</span> : null}</p></div>
        <label className="text-sm font-medium">Status
          <select aria-label={`Status for ${ticket.subject}`} value={ticket.status} disabled={saving === ticket.id}
            className="block border rounded-lg p-2 mt-1 bg-white" onChange={e => void updateStatus(ticket.id, e.target.value as SupportStatus)}>
            <option value="new">New</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option>
          </select>
        </label>
      </div>
      <p className="whitespace-pre-wrap break-words">{ticket.message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Saved reply for ${ticket.subject}`} className="border rounded-lg p-2 bg-white text-sm" value={replyChoice[ticket.id] || ''} onChange={e => setReplyChoice({ ...replyChoice, [ticket.id]: e.target.value })}>
          <option value="">Blank reply</option>
          {SAVED_REPLIES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <Button asChild variant="outline"><a href={`mailto:${encodeURIComponent(ticket.email)}?subject=${encodeURIComponent(`Re: ${ticket.subject} [${ticket.id}]`)}${replyChoice[ticket.id] ? `&body=${encodeURIComponent((SAVED_REPLIES.find(r => r.id === replyChoice[ticket.id])?.body || '').replaceAll('[Name]', ticket.name.split(' ')[0] || 'there'))}` : ''}`}>Reply by email</a></Button>
      </div>
    </CardContent></Card>)}
    {loading && <p role="status">Loading enquiries…</p>}
    {nextCursor && <Button disabled={loading} onClick={() => void load(nextCursor)}>Load older enquiries</Button>}
  </div>;
}

export default function SupportPage() {
  return <EmployeeLayout isAdmin><SupportInbox /></EmployeeLayout>;
}
