'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** "How did we do?" from a resolution email. Confirmed with a click so link scanners can't submit it. */
export default function FeedbackPage() {
  const [params, setParams] = useState<{ k: string; id: string; t: string } | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'ready' | 'saving' | 'done' | 'error'>('ready');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setParams({ k: p.get('k') || '', id: p.get('id') || '', t: p.get('t') || '' });
    const s = Number(p.get('s')); if (Number.isInteger(s) && s >= 1 && s <= 5) setScore(s);
  }, []);

  async function submit() {
    if (!params || !score) return;
    setState('saving');
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: params.k, id: params.id, token: params.t, score, comment }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }

  return <PublicLayout>
    <main className="min-h-[70vh] bg-gray-50 pt-40 pb-24 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border p-8 sm:p-10 space-y-5 text-center">
        <h1 className="text-3xl font-black text-primary uppercase tracking-tight">How did we do?</h1>
        {state === 'done' ? <p className="text-lg" role="status">Thank you! Your feedback helps us improve.</p>
          : state === 'error' ? <p className="text-lg" role="status">That link didn’t work. Reply to our email or call (415) 214-5474 to tell us how we did.</p>
          : <>
            <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} out of 5`} onClick={() => setScore(n)}>
                <Star className={`h-10 w-10 ${n <= score ? 'fill-accent text-accent' : 'text-gray-300'}`} />
              </button>)}
            </div>
            <Textarea aria-label="Anything to add? (optional)" placeholder="Anything to add? (optional)" value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} />
            <Button onClick={() => void submit()} disabled={!score || state === 'saving' || !params?.t} className="bg-accent hover:bg-accent/90 text-white">{state === 'saving' ? 'Sending…' : 'Send feedback'}</Button>
          </>}
      </div>
    </main>
  </PublicLayout>;
}
