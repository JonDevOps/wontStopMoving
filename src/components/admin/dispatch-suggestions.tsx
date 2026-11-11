'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Candidate = { id: string; name: string; score: number; eligible: boolean; reasons: string[]; warnings: string[] };

/** Ranked providers for this job; one click assigns and emails the provider. */
export function DispatchSuggestions({ jobId }: { jobId: string }) {
  const auth = useAuth();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try { const r = await apiFetch<{ candidates: Candidate[]; assigned: string[] }>(auth, `/api/admin/dispatch?jobId=${encodeURIComponent(jobId)}`); setCandidates(r.candidates); setAssigned(r.assigned); }
    catch (e) { setCandidates([]); setNotice(e instanceof Error ? e.message : 'Could not load suggestions.'); }
  }, [auth, jobId]);
  useEffect(() => { void load(); }, [load]);

  async function assign(id: string) {
    setBusy(id); setNotice('');
    try { await apiFetch(auth, '/api/admin/dispatch', { jobId, providerId: id }); setNotice('Assigned. The provider has been emailed the job.'); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not assign.'); }
    finally { setBusy(null); }
  }

  return <Card className="mb-6">
    <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> Suggested providers</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Ranked by area, availability that day, rating and experience. Only approved providers can be assigned.</p>
      {notice && <p role="status" className="text-sm font-medium">{notice}</p>}
      {candidates === null ? <p className="text-sm">Finding providers…</p> : candidates.length === 0 ? <p className="text-sm text-muted-foreground">No providers yet.</p> :
        candidates.slice(0, 6).map((c, i) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg">
          <div className="min-w-0 space-y-1">
            <p className="font-bold">{i === 0 && c.eligible ? '★ ' : ''}{c.name}</p>
            <div className="flex flex-wrap gap-1">
              {c.reasons.map(r => <Badge key={r} className="bg-green-100 text-green-800 border-none font-medium">{r}</Badge>)}
              {c.warnings.map(w => <Badge key={w} className="bg-amber-100 text-amber-900 border-none font-medium">{w}</Badge>)}
            </div>
          </div>
          {assigned.includes(c.id) ? <Badge className="bg-primary text-white border-none">Assigned</Badge>
            : <Button size="sm" disabled={!c.eligible || busy === c.id} onClick={() => void assign(c.id)}>{busy === c.id ? 'Assigning…' : 'Assign'}</Button>}
        </div>)}
    </CardContent>
  </Card>;
}
