'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConciergeBell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { CONCIERGE_SERVICES, CONCIERGE_STATUSES, type ConciergeService, type ConciergeStatus } from '@/lib/concierge';
import { useToast } from '@/hooks/use-toast';

type Req = { id: string; service: ConciergeService; status: ConciergeStatus; partnerName: string | null };

/** "Need anything else for your move?" Partner services the team lines up for the customer. */
export function MoveConcierge({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Req[]>([]);
  const [picked, setPicked] = useState<ConciergeService | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    apiFetch<{ requests: Req[] }>(auth, `/api/concierge?jobId=${encodeURIComponent(jobId)}`).then(r => setRequests(r.requests)).catch(() => {});
  }, [auth, jobId]);
  useEffect(() => { load(); }, [load]);
  if (jobStatus === 'cancelled') return null;

  const asked = new Set(requests.filter(r => r.status !== 'closed').map(r => r.service));
  const send = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await apiFetch(auth, '/api/concierge', { jobId, service: picked, note });
      toast({ title: 'Request sent', description: 'We’ll introduce a trusted local partner, usually within one business day.' });
      setPicked(null); setNote(''); load();
    } catch (err) { toast({ variant: 'destructive', title: 'Couldn’t send', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(false); }
  };

  return (
    <Card className="border-none shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><ConciergeBell className="h-5 w-5 text-accent" /> Moving concierge</CardTitle>
        <CardDescription>Need anything else around your move? We&apos;ll connect you with a partner we trust. It costs nothing to ask.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length > 0 && <ul className="text-sm space-y-1">{requests.map(r => (
          <li key={r.id} className="flex justify-between gap-2"><span>{CONCIERGE_SERVICES[r.service]?.label || r.service}{r.partnerName ? ` · ${r.partnerName}` : ''}</span><span className="text-muted-foreground">{CONCIERGE_STATUSES[r.status] || r.status}</span></li>
        ))}</ul>}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CONCIERGE_SERVICES) as ConciergeService[]).map(k => (
            <button key={k} type="button" disabled={asked.has(k)} aria-pressed={picked === k} onClick={() => setPicked(p => (p === k ? null : k))} title={CONCIERGE_SERVICES[k].blurb}
              className={`rounded-full border px-3 py-1.5 text-sm ${picked === k ? 'border-accent bg-accent/10 font-bold' : 'border-gray-200'} disabled:opacity-40`}>
              {CONCIERGE_SERVICES[k].label}{asked.has(k) ? ' ✓' : ''}
            </button>
          ))}
        </div>
        {picked && <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{CONCIERGE_SERVICES[picked].blurb}</p>
          <Textarea rows={2} maxLength={1000} placeholder="Anything we should know? (optional)" value={note} onChange={e => setNote(e.target.value)} aria-label="Note for the concierge" />
          <Button onClick={() => void send()} disabled={busy}>{busy ? 'Sending…' : `Ask for ${CONCIERGE_SERVICES[picked].label.toLowerCase()}`}</Button>
        </div>}
      </CardContent>
    </Card>
  );
}
