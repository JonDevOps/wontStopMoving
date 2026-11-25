'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { MOVER_CART_KEY } from '@/lib/mover-cart';
import { Button } from '@/components/ui/button';

/** Where guests land after paying for a mover cart (#151). */
export default function GuestBookedPage() {
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'error'>('checking');
  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) { setStatus('error'); return; }
    fetch('/api/movers/guest-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setStatus('error'); return; }
        setStatus(d.paid ? 'paid' : 'pending');
        if (d.paid) { try { sessionStorage.removeItem(MOVER_CART_KEY); sessionStorage.removeItem('wsm-cart-attempt'); } catch { /* ignore */ } }
      })
      .catch(() => setStatus('error'));
  }, []);
  return <PublicLayout><div className="bg-slate-50 pt-32 pb-20 min-h-[70vh]"><div className="container mx-auto max-w-2xl px-4">
    <div className="bg-white border rounded-3xl p-8 space-y-5">
      {status === 'checking' && <p role="status">Confirming your payment…</p>}
      {status === 'paid' && <>
        <h1 className="text-3xl font-bold text-primary">You&apos;re booked!</h1>
        <p>We emailed you two things:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li><strong>Your payment release code.</strong> Give it to your crew only after the work is done. If you added a mobile number for texts, we&apos;ll text it once texting is active.</li>
          <li><strong>A link to set your password</strong> for your new Wont Stop Moving account, where you can see your booking and release payment from your phone.</li>
        </ol>
        <p className="text-sm text-slate-600">Don&apos;t see the emails? Check spam, or call us and we&apos;ll help.</p>
        <Button asChild><Link href="/login?role=customer">Sign in</Link></Button>
      </>}
      {status === 'pending' && <><h1 className="text-2xl font-bold">Payment processing</h1><p>Your payment hasn&apos;t finished yet. You&apos;ll get a confirmation email as soon as it does.</p></>}
      {status === 'error' && <><h1 className="text-2xl font-bold">We couldn&apos;t confirm this checkout</h1><p>If you were charged, your booking is safe. Check your email for your confirmation, or <Link href="/contact" className="underline">contact us</Link>.</p></>}
    </div>
  </div></div></PublicLayout>;
}
