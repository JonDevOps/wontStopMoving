'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { MOVER_CART_KEY, moverCartSchema, type MoverCartItem } from '@/lib/mover-cart';
import { TermsAcceptance } from '@/components/legal/terms-acceptance';
import { TERMS_VERSION } from '@/lib/terms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MoverCart() {
  const textsEnabled = process.env.NEXT_PUBLIC_MARKETPLACE_SMS_ENABLED === 'true';
  const checkoutEnabled = process.env.NEXT_PUBLIC_MARKETPLACE_CHECKOUT_ENABLED === 'true';
  const auth = useAuth(), { user } = useUser();
  const [items, setItems] = useState<MoverCartItem[]>([]), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [terms, setTerms] = useState(false), [sms, setSms] = useState(false), [phone, setPhone] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { try { const parsed = moverCartSchema.safeParse(JSON.parse(sessionStorage.getItem(MOVER_CART_KEY) || '[]')); if (parsed.success) setItems(parsed.data); } catch { setError('Your saved cart could not be loaded. Add your crew again.'); } setReady(true); }, []);
  function remove(id: string) { const remaining = items.filter(item => item.id !== id); sessionStorage.setItem(MOVER_CART_KEY, JSON.stringify(remaining)); setItems(remaining); }
  async function pay(event: React.FormEvent) {
    event.preventDefault(); setError(''); if (!user) { setError('Sign in before continuing to payment. Your cart stays in this browser tab.'); return; }
    setBusy(true);
    try {
      const fingerprint = JSON.stringify({items,phone,sms});
      const saved = JSON.parse(sessionStorage.getItem('wsm-cart-attempt') || 'null');
      const requestId = saved?.fingerprint === fingerprint ? saved.requestId : crypto.randomUUID();
      sessionStorage.setItem('wsm-cart-attempt', JSON.stringify({fingerprint,requestId}));
      const result = await apiFetch<{url: string}>(auth, '/api/movers/checkout', {items,requestId,phone,smsConsent:textsEnabled && sms,termsAccepted:terms,termsVersion:TERMS_VERSION});
      if (!result.url) throw new Error('Checkout is unavailable. Please try again.');
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Checkout is unavailable.'); setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-4xl font-bold">Your moving crews</h1><p>Pay once. Each crew receives its own job and payment code. Release each code only after that crew finishes their work.</p>
    {!ready ? <p>Loading your cart…</p> : !items.length ? <p>Your cart is empty. <Link className="underline" href="/movers">Find a moving crew</Link>.</p> : <>
      {items.map(item => <article key={item.id} className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="text-xl font-bold">{item.providerName}</h2><p>{item.service} · {item.moveDate} · {item.preferredStartTime} · {item.hours} hours</p><p className="break-words">{item.pickupAddress} → {item.dropoffAddress}</p><p className="font-bold">${((item.quotedRate || 0) * item.hours).toFixed(2)} service subtotal</p><Button variant="outline" onClick={() => remove(item.id)} disabled={busy}>Remove {item.service} crew</Button></article>)}
      <div className="flex flex-wrap gap-4"><Link href="/movers?leg=unloading" className="underline font-semibold">Add an unloading crew</Link><Link href="/movers" className="underline">Add another service</Link></div>
      <form onSubmit={pay} className="bg-white border rounded-2xl p-6 space-y-5"><p className="font-bold text-2xl">Total: ${items.reduce((sum,item) => sum+(item.quotedRate || 0)*item.hours,0).toFixed(2)} USD</p><p className="text-sm">We verify current provider rates and availability before opening Stripe checkout. The provider receives 85%; W3Develops retains 15%. After the payment code is redeemed, submit an honest review of any rating for a $5 refund per eligible job to your original payment method. Optional tipping unlocks after the review.</p>
        {textsEnabled ? <><div><Label htmlFor="cart-phone">Mobile number for payment-code texts (optional)</Label><Input id="cart-phone" type="tel" placeholder="+14155550123" value={phone} onChange={e => setPhone(e.target.value)} maxLength={16}/></div>
        <label className="flex gap-3 items-start"><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)}/>I agree to receive transactional payment-code and job texts at this number. Message/data rates may apply. Reply STOP to opt out. Consent is optional; codes remain available by email and in my job dashboard.</label></> : <p className="text-sm">Payment codes and job updates are available by email and in your dashboard. Text notifications are not available yet.</p>}
        <TermsAcceptance id="cart-terms" checked={terms} onChange={setTerms} disabled={busy}/>
        {!checkoutEnabled ? <p role="status">Marketplace checkout is opening soon. <Link href="/book" className="underline">Book our team directly</Link> or <Link href="/contact" className="underline">contact us for help</Link>.</p> : !user ? <Link href="/login?role=customer&redirect=%2Fmovers%2Fcart" className="block underline">Sign in to pay</Link> : <Button type="submit" disabled={busy || !terms}>{busy ? 'Opening secure checkout…' : 'Continue to payment'}</Button>}
      </form>
    </>}{error && <p role="alert" className="text-red-700">{error}</p>}</div>;
}
