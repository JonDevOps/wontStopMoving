'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tipShareCents } from '@/lib/mover-cart';

export function MoveBenefits({ jobId, eligible, refundStatus, tipCents }: { jobId: string; eligible: boolean; refundStatus?: string; tipCents?: number }) {
  const auth = useAuth();
  const [tip, setTip] = useState('20'), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [status, setStatus] = useState(refundStatus);
  const cents = Math.round(Number(tip) * 100);
  useEffect(() => { setStatus(refundStatus); }, [refundStatus]);
  useEffect(() => {
    if (!eligible) return;
    apiFetch<{refundStatus:string}>(auth, '/api/movers/benefits', {jobId}).then(result => setStatus(result.refundStatus)).catch(() => setMessage('Your review is saved. Contact support if your refund remains pending.'));
  }, [auth, eligible, jobId]);
  async function refund() {
    setBusy(true);
    try { const result = await apiFetch<{refundStatus:string}>(auth, '/api/movers/benefits', {jobId}); setStatus(result.refundStatus); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Please contact support.'); }
    finally { setBusy(false); }
  }
  async function payTip(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const result = await apiFetch<{url:string}>(auth, '/api/movers/tip', {jobId,amountCents:cents}); if (!result.url) throw new Error('Tip checkout is unavailable.'); window.location.assign(result.url); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Tip checkout is unavailable.'); setBusy(false); }
  }
  return <section className="bg-white border rounded-2xl p-6 space-y-5"><h2 className="text-xl font-bold">Thank you for your review</h2>
    {eligible && <div className="space-y-3"><p>{status === 'refunded' ? '$5 refunded to your original payment types. Gift-card amounts return to your gift-card balance; your bank controls card refund timing.' : status === 'processing' ? 'Your $5 refund is processing to your original payment method.' : 'Your review qualifies for a $5 refund to your original payment method. The refund is awaiting processing; contact support if it remains pending.'}</p><p className="text-sm">W3Develops funds this refund from its platform fee. Your mover’s 85% share stays the same.</p>{status !== 'refunded' && <Button disabled={busy} variant="outline" onClick={refund}>Check refund</Button>}</div>}
    {tipCents ? <p>Thank you for your ${(tipCents/100).toFixed(2)} tip.</p> : <form onSubmit={payTip} className="space-y-3"><h3 className="font-bold">Leave an optional tip</h3><Label htmlFor="move-tip">Tip amount in USD</Label><Input id="move-tip" required type="number" min={1} max={1000} step="0.01" value={tip} onChange={e => setTip(e.target.value)}/><p className="text-sm">A 10% processing/platform fee is deducted from the tip. Your mover receives 90%; the normal 15% booking fee does not apply.</p>{Number.isFinite(cents) && cents > 0 && <p>Your mover receives ${(tipShareCents(cents)/100).toFixed(2)}; fee ${((cents-tipShareCents(cents))/100).toFixed(2)}.</p>}<Button disabled={busy} type="submit">{busy ? 'Please wait…' : 'Continue to tip payment'}</Button></form>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
