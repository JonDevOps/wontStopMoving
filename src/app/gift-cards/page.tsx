'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Gift } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { GIFT_CARD_MAX, GIFT_CARD_MIN, GIFT_CARD_PRESETS, giftCardAmount } from '@/lib/rewards';

function GiftCards() {
  const params = useSearchParams();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [amount, setAmount] = useState('100');
  const [form, setForm] = useState({ recipientName: '', recipientEmail: '', fromName: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = giftCardAmount(amount) !== null;

  const buy = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { url } = await apiFetch<{ url: string }>(auth, '/api/gift-cards/checkout', { amount: Number(amount), ...form });
      window.location.assign(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start checkout.'); setBusy(false); }
  };

  return (
    <PublicLayout>
      <section className="bg-primary pt-36 pb-14 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-3">
          <Gift className="h-12 w-12 text-accent mx-auto" />
          <h1 className="text-4xl md:text-5xl font-headline font-black uppercase">Give the gift of <span className="text-accent">moving day help</span></h1>
          <p className="text-white/80">A Wont Stop Moving gift card becomes move credit for a friend, a new grad or family members downsizing. Delivered by email. Never expires.</p>
        </div>
      </section>
      <section className="py-14 bg-gray-50">
        <div className="max-w-xl mx-auto px-4">
          {params.get('sent') ? (
            <div className="bg-white rounded-3xl p-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-xl font-black text-primary">Your gift card is on its way</p>
              <p className="text-muted-foreground">We&apos;ve emailed it to your recipient and sent you a copy of the code.</p>
              <Button asChild variant="outline"><Link href="/gift-cards">Send another</Link></Button>
            </div>
          ) : (
            <form onSubmit={buy} className="bg-white rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
              <div>
                <p className="text-sm font-bold mb-2">Amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {GIFT_CARD_PRESETS.map(p => (
                    <button key={p} type="button" aria-pressed={amount === String(p)} onClick={() => setAmount(String(p))}
                      className={`rounded-xl border-2 h-12 font-black ${amount === String(p) ? 'border-accent bg-accent/10 text-primary' : 'border-gray-200'}`}>${p}</button>
                  ))}
                </div>
                <Label htmlFor="gc-amount" className="block mt-3 text-xs text-muted-foreground">Or any whole-dollar amount from ${GIFT_CARD_MIN} to ${GIFT_CARD_MAX.toLocaleString()}</Label>
                <Input id="gc-amount" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label htmlFor="gc-rname">Recipient&apos;s name</Label><Input id="gc-rname" maxLength={120} value={form.recipientName} onChange={set('recipientName')} /></div>
                <div><Label htmlFor="gc-remail">Recipient&apos;s email</Label><Input id="gc-remail" type="email" required value={form.recipientEmail} onChange={set('recipientEmail')} /></div>
                <div className="sm:col-span-2"><Label htmlFor="gc-from">From</Label><Input id="gc-from" maxLength={120} placeholder="Your name" value={form.fromName} onChange={set('fromName')} /></div>
              </div>
              <div><Label htmlFor="gc-msg">Message (optional)</Label><Textarea id="gc-msg" rows={3} maxLength={500} value={form.message} onChange={set('message')} /></div>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              {isUserLoading ? null : user ? (
                <Button type="submit" className="w-full h-12 font-black uppercase" disabled={busy || !valid}>{busy ? 'Opening checkout…' : `Buy $${valid ? amount : '—'} gift card`}</Button>
              ) : (
                <Button asChild className="w-full h-12 font-black uppercase"><Link href="/login?role=customer&redirect=/gift-cards">Sign in to buy</Link></Button>
              )}
              <p className="text-xs text-muted-foreground">Gift cards are redeemed as move credit in the recipient&apos;s account and never expire. Credit can pay up to 15% of each move, and any balance carries over to the next one. Not redeemable for cash except where the law requires it.</p>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

export default function GiftCardsPage() {
  return <Suspense><GiftCards /></Suspense>;
}
