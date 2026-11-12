'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { VALUATION_CHOICES, type MoveDoc, type Signature, type ValuationChoice } from '@/lib/move-documents';
import { useToast } from '@/hooks/use-toast';

type Data = { facts: { interstate: boolean; storage: boolean }; docs: MoveDoc[]; signatures: Signature[]; outstanding: string[] };

function DocRow({ doc, signed, onSign, locked }: { doc: MoveDoc; signed?: Signature; onSign: (body: Record<string, unknown>) => Promise<void>; locked: boolean }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [choice, setChoice] = useState<ValuationChoice | ''>('');
  const [busy, setBusy] = useState(false);
  return (
    <li className="border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{doc.title}</p>
          <p className="text-sm text-muted-foreground">{doc.summary}{doc.link && <> <a className="underline" href={doc.link} target="_blank" rel="noreferrer noopener">Read it</a></>}</p>
        </div>
        {signed && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-label="Done" />}
      </div>
      {signed ? (
        <p className="text-xs text-green-700">{doc.kind === 'ack' ? 'Acknowledged' : 'Signed'} by {signed.signedName}{signed.at ? ` on ${new Date(signed.at).toLocaleString()}` : ''}{signed.choice ? ` · ${VALUATION_CHOICES[signed.choice]}` : ''}</p>
      ) : doc.kind === 'info' || locked ? null : (
        <div className="space-y-2">
          {doc.id === 'valuation' && <div className="space-y-1" role="radiogroup" aria-label="Protection choice">
            {(Object.keys(VALUATION_CHOICES) as ValuationChoice[]).map(c => <label key={c} className="flex items-start gap-2 text-sm"><input type="radio" name={`val-${doc.id}`} checked={choice === c} onChange={() => setChoice(c)} className="mt-1" />{VALUATION_CHOICES[c]}</label>)}
          </div>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />
            {doc.kind === 'ack' ? 'I received and read this.' : 'I have read and agree to this document, and I am signing it electronically.'}</label>
          <div className="flex gap-2">
            <Input aria-label={`Full name to sign ${doc.title}`} placeholder="Type your full name" value={name} onChange={e => setName(e.target.value)} />
            <Button disabled={busy || !agree || name.trim().split(/\s+/).length < 2 || (doc.id === 'valuation' && !choice)}
              onClick={() => { setBusy(true); void onSign({ docId: doc.id, signedName: name, agree, choice: choice || undefined }).finally(() => setBusy(false)); }}>
              {doc.kind === 'ack' ? 'Acknowledge' : 'Sign'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Documents to sign before moving day, chosen for this move. */
export function MoveDocuments({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => { apiFetch<Data>(auth, `/api/move-documents?jobId=${encodeURIComponent(jobId)}`).then(setData).catch(() => setData(null)); }, [auth, jobId]);
  useEffect(() => { load(); }, [load]);
  if (!data || jobStatus === 'cancelled') return null;
  const sign = async (body: Record<string, unknown>) => {
    try { await apiFetch(auth, '/api/move-documents', { jobId, ...body }); load(); }
    catch (err) { toast({ variant: 'destructive', title: 'Couldn’t sign', description: err instanceof Error ? err.message : '' }); }
  };
  const left = data.outstanding.length;
  return (
    <Card className="border-none shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><FileSignature className="h-5 w-5 text-accent" /> Move documents</CardTitle>
        <CardDescription>{left ? `${left} to sign before moving day.` : 'All set. Thank you!'} {data.facts.interstate ? 'This is an interstate move, so federal booklets are included.' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">{data.docs.map(d => <DocRow key={d.id} doc={d} signed={data.signatures.find(s => s.docId === d.id)} onSign={sign} locked={jobStatus === 'completed'} />)}</ul>
      </CardContent>
    </Card>
  );
}
