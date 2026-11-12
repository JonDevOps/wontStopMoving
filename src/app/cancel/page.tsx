'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Phone, XCircle } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { SITE_PHONE } from '@/lib/seo';

type Kind = 'reschedule' | 'cancel';

/** Self-service cancel / reschedule. Signed-in customers go to their move; everyone else sends a request ticket. */
export default function CancelPage() {
  const { user } = useUser();
  const [kind, setKind] = useState<Kind>('reschedule');
  const [form, setForm] = useState({ name: '', email: '', phone: '', reference: '', moveDate: '', newDate: '', reason: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const lines = [
      kind === 'cancel' ? 'Please CANCEL my move.' : 'Please RESCHEDULE my move.',
      form.reference && `Booking / quote reference: ${form.reference}`,
      form.moveDate && `Current move date: ${form.moveDate}`,
      kind === 'reschedule' && form.newDate && `Preferred new date: ${form.newDate}`,
      form.reason && `Reason: ${form.reason}`,
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch('/api/support', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, subject: `[${kind === 'cancel' ? 'Cancel' : 'Reschedule'}] ${form.reference || form.moveDate || 'move'}`.slice(0, 200), message: lines, website: form.website }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not send your request.');
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send your request.'); }
    finally { setBusy(false); }
  };

  return (
    <PublicLayout>
      <section className="bg-primary pt-40 pb-16 text-white">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-headline font-black mb-4">Cancel or reschedule</h1>
          <p className="text-white/80">Plans change. Tell us what you need and we&apos;ll confirm within 4 business hours. Moving in the next 48 hours? Call <a className="underline font-bold" href={`tel:${SITE_PHONE}`}>(415) 214-5474</a>.</p>
        </div>
      </section>
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {user && (
            <Card className="border-accent/40">
              <CardHeader><CardTitle>You&apos;re signed in</CardTitle><CardDescription>Open your move and choose <b>Reschedule</b> or <b>Cancel</b>. Your request goes straight to the team and stays on the move&apos;s history.</CardDescription></CardHeader>
              <CardContent><Button asChild><Link href="/dashboard/customer/moves">Go to my moves</Link></Button></CardContent>
            </Card>
          )}
          {done ? (
            <Card><CardContent className="py-10 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-lg font-bold">Request received</p>
              <p className="text-muted-foreground">We&apos;ll email {form.email} to confirm. Any cancellation fees follow the terms in your booking agreement, and we&apos;ll tell you about them before anything is charged.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>{user ? 'Or send a request' : 'Send a request'}</CardTitle><CardDescription>Use the email you booked with so we can find your move.</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What do you need?">
                    {([['reschedule', 'Reschedule', CalendarClock], ['cancel', 'Cancel', XCircle]] as const).map(([k, label, Icon]) => (
                      <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 h-14 font-bold ${kind === k ? 'border-accent bg-accent/10 text-primary' : 'border-gray-200 text-muted-foreground'}`}>
                        <Icon className="h-5 w-5" />{label}
                      </button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label htmlFor="c-name">Name</Label><Input id="c-name" required minLength={2} value={form.name} onChange={set('name')} /></div>
                    <div><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" required value={form.email} onChange={set('email')} /></div>
                    <div><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" value={form.phone} onChange={set('phone')} /></div>
                    <div><Label htmlFor="c-ref">Booking or quote number (if you have it)</Label><Input id="c-ref" maxLength={60} value={form.reference} onChange={set('reference')} /></div>
                    <div><Label htmlFor="c-date">Current move date</Label><Input id="c-date" type="date" value={form.moveDate} onChange={set('moveDate')} /></div>
                    {kind === 'reschedule' && <div><Label htmlFor="c-new">Preferred new date</Label><Input id="c-new" type="date" required value={form.newDate} onChange={set('newDate')} /></div>}
                  </div>
                  <div><Label htmlFor="c-reason">Anything we should know? (optional)</Label><Textarea id="c-reason" rows={3} maxLength={2000} value={form.reason} onChange={set('reason')} /></div>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={form.website} onChange={set('website')} />
                  {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                  <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? 'Sending…' : kind === 'cancel' ? 'Request cancellation' : 'Request new date'}</Button>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Prefer to talk? <a className="underline" href={`tel:${SITE_PHONE}`}>(415) 214-5474</a></p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
