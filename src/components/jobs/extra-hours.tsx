'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export type HoursRequest = { id: string; hours: number; fromHours: number; extraCents: number; reason: string; status: 'pending' | 'accepted' | 'declined' | 'payment_failed'; error?: string };
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Crew side (#153): ask the customer to approve more hours. */
export function RequestExtraHours({ jobId, hoursReserved, hourlyRate, request }: { jobId: string; hoursReserved: number; hourlyRate: number; request?: HoursRequest | null }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [hours, setHours] = useState(hoursReserved + 1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const extra = Math.max(0, hours - hoursReserved) * hourlyRate;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await apiFetch(auth, '/api/jobs/hours', { action: 'request', jobId, hours, reason });
      toast({ title: 'Request sent', description: 'The customer was emailed and will see it in their app.' });
      setReason('');
    } catch (err) { toast({ variant: 'destructive', title: 'Could not send request', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(false); }
  }
  return <Card className="border-none shadow-md bg-white mt-6">
    <CardHeader className="pb-2"><CardTitle className="text-sm font-black tracking-widest uppercase">Need more time?</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {request && <p className="text-sm rounded-lg bg-slate-50 p-3">
        Last request: {request.fromHours} → {request.hours} hours ({money(request.extraCents)}) · <strong className="capitalize">{request.status.replace('_', ' ')}</strong>
        {request.status === 'payment_failed' && request.error ? ` · ${request.error}` : ''}
      </p>}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="extra-hours">New total hours</Label><Input id="extra-hours" type="number" min={hoursReserved + 1} max={24} step={1} value={hours} onChange={e => setHours(Number(e.target.value))} /></div>
          <div><p className="text-xs text-muted-foreground mt-6">Booked: {hoursReserved} h · extra {money(Math.round(extra * 100))}</p></div>
        </div>
        <div><Label htmlFor="extra-reason">Why do you need more time?</Label><Input id="extra-reason" maxLength={300} required placeholder="e.g. more items than listed, long carry" value={reason} onChange={e => setReason(e.target.value)} /></div>
        <Button type="submit" disabled={busy || hours <= hoursReserved || !reason.trim()}>{busy ? 'Sending…' : 'Ask customer to approve'}</Button>
        <p className="text-xs text-muted-foreground">The customer approves in their app and is charged right away. You&apos;re paid your share of the extra time when the job is released.</p>
      </form>
    </CardContent>
  </Card>;
}

/** Customer side (#153): approve or decline the crew's request. */
export function ApproveExtraHours({ jobId, crewName, request }: { jobId: string; crewName: string; request: HoursRequest }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  async function respond(action: 'accept' | 'decline') {
    setBusy(action);
    try {
      await apiFetch(auth, '/api/jobs/hours', { action, jobId });
      toast({ title: action === 'accept' ? 'Extra hours approved' : 'Request declined', description: action === 'accept' ? `Your card was charged ${money(request.extraCents)}.` : `${crewName} will be told.` });
    } catch (err) { toast({ variant: 'destructive', title: 'That didn’t work', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(null); }
  }
  if (request.status === 'accepted' || request.status === 'declined') return null;
  return <Card className="border-2 border-amber-400 shadow-lg bg-amber-50 mt-6">
    <CardHeader className="pb-2"><CardTitle className="text-sm font-black tracking-widest uppercase text-amber-900">{crewName} asked for more time</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p>Change from <strong>{request.fromHours}</strong> to <strong>{request.hours} hours</strong> for an extra <strong>{money(request.extraCents)}</strong>.</p>
      <p className="italic">“{request.reason}”</p>
      {request.status === 'payment_failed' && <p className="text-red-700 font-semibold">{request.error || 'The last payment attempt failed.'}</p>}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!!busy} onClick={() => void respond('accept')}>{busy === 'accept' ? 'Charging…' : `Accept and pay ${money(request.extraCents)}`}</Button>
        <Button variant="outline" disabled={!!busy} onClick={() => void respond('decline')}>{busy === 'decline' ? 'Declining…' : 'Decline'}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Accepting charges the card you booked with right away.</p>
    </CardContent>
  </Card>;
}
