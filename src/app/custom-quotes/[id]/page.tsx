'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, FileText, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { customQuotePricingText, type CustomPricing } from '@/lib/custom-quotes';
import { TermsConfirmation } from '@/components/legal/terms-confirmation';
import { TERMS_VERSION } from '@/lib/terms';
import { EmailVerificationNotice } from '@/components/auth/email-verification-notice';

type Quote = { id: string; name: string; description: string; pickupAddress: string; dropoffAddress: string; moveDate: string; expiresAt: string; pricing: CustomPricing; status: string };

const formatDate = (value: string, withTime = false) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value || '—';
  return d.toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

function Detail({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: React.ReactNode }) {
  return <div className="flex gap-3">
    <div className="h-10 w-10 shrink-0 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Icon className="h-5 w-5" /></div>
    <div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p><div className="font-semibold text-primary">{children}</div></div>
  </div>;
}

export default function ReviewCustomQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auth = useAuth(); const { user, isUserLoading } = useUser();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);

  const open = useCallback(async () => {
    setBusy(true); setError('');
    try { setQuote(await apiFetch<Quote>(auth, `/api/custom-quotes/${id}`, {})); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open quote.'); }
    finally { setBusy(false); }
  }, [auth, id]);

  // Open automatically once signed in with a verified email.
  useEffect(() => {
    setQuote(null); setConfirm(false); setError('');
    if (user?.emailVerified) void open();
  }, [user?.uid, user?.emailVerified, open]);

  async function pay() {
    setBusy(true); setError('');
    try { const { url } = await apiFetch<{ url: string }>(auth, '/api/stripe/quote-checkout', { quoteId: id, termsAccepted: true, termsVersion: TERMS_VERSION }); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : 'Checkout failed.'); setBusy(false); setConfirm(false); }
  }

  const here = `/custom-quotes/${id}`;
  const expired = quote && (quote.status === 'expired' || Date.parse(quote.expiresAt) <= Date.now());
  const booked = quote?.status === 'processed';
  const fixed = quote?.pricing.type === 'fixed' ? quote.pricing : null;

  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-accent">Private quote</p>
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Your custom <span className="text-accent">moving quote</span></h1>
        </div>

        {isUserLoading ? <p className="text-center text-muted-foreground">Loading…</p>
          : !user ? <div className="bg-white rounded-3xl shadow-xl p-8 space-y-5 text-center">
            <ShieldCheck className="h-10 w-10 text-accent mx-auto" />
            <p className="text-lg font-semibold text-primary">This quote is private.</p>
            <p className="text-muted-foreground">Sign in, or create a customer account, using the email address this quote was sent to.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-xl font-bold"><Link href={`/login?role=customer&redirect=${encodeURIComponent(here)}`}>Sign in to view</Link></Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl font-bold"><Link href="/signup">Create account</Link></Button>
            </div>
            <p className="text-xs text-muted-foreground">New account? Verify your email, then come back to this link. The quote also appears under My Quotes.</p>
          </div>
          : <>
            <EmailVerificationNotice />
            {!user.emailVerified && <p className="text-center text-sm text-muted-foreground">Signed in as {user.email}. Verify your email to open this quote.</p>}

            {!quote && user.emailVerified && !error && <p className="text-center text-muted-foreground">{busy ? 'Opening your quote…' : ''}</p>}
            {!quote && user.emailVerified && error && <div className="text-center"><Button onClick={() => void open()} disabled={busy}>Try again</Button></div>}

            {quote && <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Prepared for</p>
                  <p className="text-2xl font-black">{quote.name}</p>
                </div>
                <div className="sm:text-right">
                  {fixed ? <>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fixed total</p>
                    <p className="text-4xl font-black text-accent">${fixed.total.toFixed(2)}</p>
                  </> : <p className="font-bold text-accent max-w-xs">{customQuotePricingText(quote.pricing)}</p>}
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                <div className="grid sm:grid-cols-2 gap-6">
                  <Detail icon={Calendar} label="Move date">{formatDate(quote.moveDate)}</Detail>
                  <Detail icon={Clock} label="Quote valid until">{formatDate(quote.expiresAt, true)}</Detail>
                  <Detail icon={MapPin} label="Pickup">{quote.pickupAddress || '—'}</Detail>
                  <Detail icon={MapPin} label="Drop-off">{quote.dropoffAddress || '—'}</Detail>
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400"><FileText className="h-4 w-4" /> What’s included</p>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-gray-50 rounded-2xl p-5">{quote.description}</p>
                </div>

                <div className="border-t pt-6 space-y-3">
                  {booked ? <p className="font-bold text-green-700">This quote is booked. Thank you! Track your move in your dashboard.</p>
                    : expired ? <p className="font-bold text-amber-700">This quote has expired. Contact us for an updated price.</p>
                    : fixed ? <>
                      <Button size="lg" className="w-full rounded-xl font-black uppercase tracking-wide h-14" disabled={busy} onClick={() => setConfirm(true)}>Accept and pay ${fixed.total.toFixed(2)}</Button>
                      <p className="text-xs text-center text-muted-foreground">Secure payment through Stripe. You’ll review the Terms of Service first.</p>
                    </>
                    : <p className="text-sm text-muted-foreground">This is an hourly estimate. To book, contact us for a final fixed price. No payment is taken for estimates.</p>}
                </div>
              </div>
            </div>}

            {error && <p role="alert" className="text-center text-red-700 font-medium">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 justify-center text-sm">
              <Link className="underline font-semibold text-primary" href="/dashboard/customer/quotes">My quotes</Link>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <Link className="underline font-semibold text-primary" href="/contact">Questions or changes?</Link>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <a className="underline font-semibold text-primary inline-flex items-center gap-1 justify-center" href="tel:+14152145474"><Phone className="h-3.5 w-3.5" />(415) 214-5474</a>
            </div>
          </>}
      </div>
    </div>
    <TermsConfirmation open={confirm} title="Accept your quote and terms" description="Review the quote above and accept the Terms of Service before paying the full fixed total." confirmLabel="Continue to payment" busy={busy} onConfirm={pay} onCancel={() => setConfirm(false)}/>
  </PublicLayout>;
}
