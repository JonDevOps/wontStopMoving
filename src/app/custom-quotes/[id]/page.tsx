'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { customQuotePricingText, type CustomPricing } from '@/lib/custom-quotes';
import { TermsConfirmation } from '@/components/legal/terms-confirmation';
import { TERMS_VERSION } from '@/lib/terms';
import { EmailVerificationNotice } from '@/components/auth/email-verification-notice';

type Quote = { id: string; name: string; description: string; pickupAddress: string; dropoffAddress: string; moveDate: string; expiresAt: string; pricing: CustomPricing; status: string };
export default function ReviewCustomQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auth = useAuth(); const { user, isUserLoading } = useUser();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  useEffect(() => { setQuote(null); setConfirm(false); setError(''); }, [user?.uid, id]);
  async function open() {
    setBusy(true); setError('');
    try { setQuote(await apiFetch<Quote>(auth, `/api/custom-quotes/${id}`, {})); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open quote.'); }
    finally { setBusy(false); }
  }
  async function pay() {
    setBusy(true); setError('');
    try { const { url } = await apiFetch<{ url: string }>(auth, '/api/stripe/quote-checkout', { quoteId: id, termsAccepted: true, termsVersion: TERMS_VERSION }); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : 'Checkout failed.'); setBusy(false); setConfirm(false); }
  }
  const unavailable = quote && (['processed', 'expired'].includes(quote.status) || Date.parse(quote.expiresAt) <= Date.now());
  return <PublicLayout><div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
    <h1 className="text-3xl font-bold">Your custom moving quote</h1>
    {!user ? <div className="space-y-4"><p>Sign in or create a customer account using the email address this quote was sent to. After signing in, reopen this link to review it.</p><div className="flex gap-4"><Button asChild disabled={isUserLoading}><Link href="/login?role=customer">Sign in</Link></Button><Button asChild variant="outline"><Link href="/signup">Create account</Link></Button></div></div> : <>
      <EmailVerificationNotice/><p>Signed in as {user.email}. Only the intended recipient can open this quote.</p>
      {!quote ? <Button disabled={busy} onClick={open}>{busy ? 'Opening…' : 'Open my quote'}</Button> : <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-xl">Prepared for {quote.name}</h2><p className="whitespace-pre-wrap">{quote.description}</p>
        <p>{customQuotePricingText(quote.pricing)}</p><p>{quote.pickupAddress} → {quote.dropoffAddress}</p><p>Move date: {quote.moveDate}</p><p>Expires: {new Date(quote.expiresAt).toLocaleString()}</p>
        {unavailable ? <p>This quote is {quote.status === 'processed' ? 'already booked' : 'no longer available'}.</p> : quote.pricing.type === 'fixed' ? <><p>The full fixed total is collected at Stripe checkout.</p><Button disabled={busy} onClick={() => setConfirm(true)}>Accept and pay ${quote.pricing.total.toFixed(2)}</Button></> : <p>To book, contact Wont Stop Moving for a finalized fixed-price quote. No payment is collected for this hourly estimate.</p>}
        <Link className="underline block" href="/contact">Questions or changes? Contact us</Link>
      </div>}
      <Link className="underline block" href="/dashboard/customer/quotes">My quotes</Link>
    </>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <TermsConfirmation open={confirm} title="Accept your quote and terms" description="Review the quote above and accept the Terms of Service before paying the full fixed total." confirmLabel="Continue to payment" busy={busy} onConfirm={pay} onCancel={() => setConfirm(false)}/>
  </div></PublicLayout>;
}
