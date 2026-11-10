'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';

/** Confirms before unsubscribing, so link scanners in mail apps can't do it by accident. */
export default function UnsubscribePage() {
  const [params, setParams] = useState<{ q: string; t: string } | null>(null);
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'error'>('ready');
  useEffect(() => { const p = new URLSearchParams(window.location.search); setParams({ q: p.get('q') || '', t: p.get('t') || '' }); }, []);

  async function confirm() {
    if (!params) return;
    setState('working');
    try {
      const r = await fetch('/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: params.q, token: params.t }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }

  return <PublicLayout>
    <main className="min-h-[70vh] bg-gray-50 pt-40 pb-24 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border p-8 sm:p-10 space-y-5 text-center">
        <h1 className="text-3xl font-black text-primary uppercase tracking-tight">Quote reminders</h1>
        {state === 'done' ? <>
          <p className="text-lg" role="status">You’re unsubscribed. We won’t send more reminders about your quote.</p>
          <p className="text-sm text-muted-foreground">You’ll still get emails about bookings you make, like confirmations and receipts.</p>
          <Button asChild><Link href="/">Back to Wont Stop Moving</Link></Button>
        </> : state === 'error' ? <>
          <p className="text-lg" role="status">That link didn’t work. It may be incomplete or expired.</p>
          <p className="text-sm text-muted-foreground">Reply to any of our emails or call (415) 214-5474 and we’ll stop the reminders for you.</p>
        </> : <>
          <p className="text-lg">Stop reminder emails about your moving quote?</p>
          <Button onClick={() => void confirm()} disabled={!params?.q || !params?.t || state === 'working'} className="bg-accent hover:bg-accent/90 text-white">{state === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}</Button>
          {params && (!params.q || !params.t) && <p className="text-sm text-muted-foreground">This link is missing information. Use the link from your email.</p>}
        </>}
      </div>
    </main>
  </PublicLayout>;
}
