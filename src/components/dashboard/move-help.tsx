'use client';

import { useCallback, useEffect, useState } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy } from 'lucide-react';
import { initializeFirebase, useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { SERVICE_REQUEST_LABELS, type ServiceRequestType } from '@/lib/service-requests';

type Request = { id: string; type: ServiceRequestType; status: 'open' | 'in-progress' | 'resolved'; reason: string; requestedDate: string | null; adminMessage: string | null; createdAt: string | null };

/** "Need help with this move?": reschedule, cancel, or report damage, with the status of past requests. */
export function MoveHelp({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const auth = useAuth();
  const { user } = useUser();
  const [requests, setRequests] = useState<Request[]>([]);
  const [type, setType] = useState<ServiceRequestType | null>(null);
  const [reason, setReason] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [item, setItem] = useState('');
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setRequests((await apiFetch<{ requests: Request[] }>(auth, `/api/service-requests?jobId=${encodeURIComponent(jobId)}`)).requests); } catch { /* shown empty */ }
  }, [auth, jobId]);
  useEffect(() => { void load(); }, [load]);

  const done = jobStatus === 'completed', started = jobStatus === 'in-progress' || done;
  const options: ServiceRequestType[] = jobStatus === 'cancelled' ? [] : done ? ['claim'] : started ? ['claim'] : ['reschedule', 'cancel'];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !user) return;
    setBusy(true); setNotice('');
    try {
      let photoPaths: string[] = [], photoNote = '';
      if (type === 'claim' && files.length) {
        try {
          const { storage } = initializeFirebase();
          photoPaths = await Promise.all(files.slice(0, 6).map(async (f, i) => {
            const path = `claims/${user.uid}/${jobId}/${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)}`;
            await uploadBytes(ref(storage, path), f, { contentType: f.type || 'image/jpeg' });
            return path;
          }));
        } catch { photoNote = ' We couldn’t upload your photos, so please reply to our email with them attached.'; }
      }
      await apiFetch(auth, '/api/service-requests', { jobId, type, reason, requestedDate: type === 'reschedule' ? requestedDate : undefined, item: type === 'claim' ? item : undefined, estimatedValue: type === 'claim' && value ? Number(value) : undefined, photoPaths });
      setNotice(`Thanks, we’ve received your ${SERVICE_REQUEST_LABELS[type].toLowerCase()}. Our team will contact you soon.${photoNote}`);
      setType(null); setReason(''); setRequestedDate(''); setItem(''); setValue(''); setFiles([]);
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'We couldn’t send that. Please call (415) 214-5474.'); }
    finally { setBusy(false); }
  }

  if (!options.length && !requests.length) return null;
  return <Card className="border-none shadow-sm bg-white mt-6">
    <CardHeader className="pb-2"><CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-accent" /> Need help with this move?</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {requests.length > 0 && <ul className="space-y-2">{requests.map(r => <li key={r.id} className="rounded-xl border p-3 text-sm space-y-1">
        <div className="flex flex-wrap items-center gap-2"><strong>{SERVICE_REQUEST_LABELS[r.type]}</strong><Badge className={`border-none ${r.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{r.status === 'resolved' ? 'Resolved' : r.status === 'in-progress' ? 'In progress' : 'Received'}</Badge></div>
        {r.requestedDate && <p className="text-muted-foreground">Requested date: {r.requestedDate}</p>}
        {r.adminMessage && <p><span className="font-medium">Our reply:</span> {r.adminMessage}</p>}
      </li>)}</ul>}
      {options.length > 0 && !type && <div className="flex flex-wrap gap-2">{options.map(o => <Button key={o} variant="outline" onClick={() => setType(o)}>{o === 'reschedule' ? 'Change my date' : o === 'cancel' ? 'Cancel my move' : 'Report damage or a missing item'}</Button>)}</div>}
      {type && <form onSubmit={submit} className="space-y-3">
        <p className="font-bold">{SERVICE_REQUEST_LABELS[type]}</p>
        {type === 'reschedule' && <div className="space-y-1"><Label htmlFor="new-date">New date you’d like</Label><Input id="new-date" type="date" required value={requestedDate} onChange={e => setRequestedDate(e.target.value)} /></div>}
        {type === 'claim' && <>
          <div className="space-y-1"><Label htmlFor="claim-item">Item</Label><Input id="claim-item" maxLength={200} value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. glass coffee table" /></div>
          <div className="space-y-1"><Label htmlFor="claim-value">Estimated value (USD, optional)</Label><Input id="claim-value" type="number" min="0" step="1" value={value} onChange={e => setValue(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="claim-photos">Photos (up to 6)</Label><Input id="claim-photos" type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 6))} /></div>
        </>}
        <div className="space-y-1"><Label htmlFor="help-reason">{type === 'cancel' ? 'Why are you cancelling?' : type === 'claim' ? 'What happened?' : 'Anything we should know?'}</Label>
          <Textarea id="help-reason" required minLength={5} maxLength={3000} value={reason} onChange={e => setReason(e.target.value)} /></div>
        {type !== 'claim' && <p className="text-xs text-muted-foreground">This sends a request to our team. Nothing changes until we confirm with you, including any price or refund.</p>}
        <div className="flex gap-2"><Button type="submit" disabled={busy} className="bg-accent hover:bg-accent/90 text-white">{busy ? 'Sending…' : 'Send request'}</Button><Button type="button" variant="ghost" onClick={() => setType(null)}>Back</Button></div>
      </form>}
      {notice && <p role="status" className="text-sm font-medium">{notice}</p>}
    </CardContent>
  </Card>;
}
