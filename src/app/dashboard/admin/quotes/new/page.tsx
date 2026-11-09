'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { customQuotePricingText, type CustomPricing } from '@/lib/custom-quotes';

export default function NewCustomQuotePage() {
  const auth = useAuth();
  const [type, setType] = useState<'fixed' | 'hourly'>('fixed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ id: string; url: string; email: string; body: string } | null>(null);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || '').trim();
    const pricing: CustomPricing = type === 'fixed' ? { type, total: Number(value('total')) } : { type, hourlyRate: Number(value('hourlyRate')), minimumHours: Number(value('minimumHours')), estimatedHours: Number(value('estimatedHours')) };
    const data = { name: value('name'), email: value('email'), description: value('description'), pickupAddress: value('pickupAddress'), dropoffAddress: value('dropoffAddress'), moveDate: value('moveDate'), expiresAt: new Date(value('expiry') + 'T23:59:59').toISOString(), pricing };
    try {
      const result = await apiFetch<{ id: string; url: string }>(auth, '/api/admin/quotes', data);
      setSaved({ ...result, email: data.email, body: `Hi ${data.name},\n\n${data.description}\n\n${customQuotePricingText(pricing)}\nRoute: ${data.pickupAddress} → ${data.dropoffAddress}\nMove date: ${data.moveDate}\nValid through: ${value('expiry')}\n\nReview your quote: ${result.url}\nSign in or create a customer account using ${data.email}, then verify that email and open this link.\n\nWont Stop Moving` });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save quote.'); }
    finally { setBusy(false); }
  }
  return <EmployeeLayout isAdmin><div className="max-w-2xl mx-auto space-y-6">
    <Link href="/dashboard/admin/quotes">← Back to quotes</Link>
    <h1 className="text-3xl font-bold">Create custom quote</h1>
    {saved ? <div className="bg-white rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold">Quote saved — ready to share</h2>
      <p>Email hasn’t been sent. Open the prepared email below and send it from your email app, or copy the review link.</p>
      <Input aria-label="Customer review link" readOnly value={saved.url}/>
      <div className="flex flex-wrap gap-3">
        <Button onClick={async () => { try { await navigator.clipboard.writeText(saved.url); setError('Link copied.'); } catch { setError('Select and copy the link above.'); } }}>Copy link</Button>
        <Button asChild><a href={`mailto:${encodeURIComponent(saved.email)}?subject=${encodeURIComponent('Your Wont Stop Moving custom quote')}&body=${encodeURIComponent(saved.body)}`}>Open email to customer</a></Button>
        <Button variant="outline" onClick={() => { setSaved(null); setError(''); }}>Create another</Button>
      </div>
      <pre className="whitespace-pre-wrap text-sm">{saved.body}</pre>
    </div> : <form onSubmit={save} className="bg-white rounded-xl p-6 space-y-4">
      <p>Only the recipient’s verified customer account can open the quote. Fixed totals are payable in full; hourly estimates are for review and require a finalized fixed-price quote before payment.</p>
      {(['name', 'email', 'pickupAddress', 'dropoffAddress', 'moveDate', 'expiry'] as const).map(name => <div key={name} className="space-y-1"><Label htmlFor={name}>{{ name: 'Customer name', email: 'Customer email', pickupAddress: 'Pickup address', dropoffAddress: 'Drop-off address', moveDate: 'Move date', expiry: 'Quote expiry date' }[name]}</Label><Input id={name} name={name} required type={name === 'email' ? 'email' : name === 'moveDate' || name === 'expiry' ? 'date' : 'text'} maxLength={name === 'email' ? 254 : 500}/></div>)}
      <Label htmlFor="description">Services included and exclusions</Label><Textarea id="description" name="description" required maxLength={3000}/>
      <Label htmlFor="pricing-type">Pricing</Label><select id="pricing-type" value={type} onChange={e => setType(e.target.value as typeof type)} className="w-full border rounded-md p-3"><option value="fixed">Fixed total</option><option value="hourly">Hourly estimate</option></select>
      {(type === 'fixed' ? ['total'] : ['hourlyRate', 'minimumHours', 'estimatedHours']).map(name => <div key={name}><Label htmlFor={name}>{{ total: 'Total price (USD)', hourlyRate: 'Hourly rate (USD for the entire quoted crew)', minimumHours: 'Minimum hours', estimatedHours: 'Estimated hours' }[name]}</Label><Input id={name} name={name} type="number" required min="0.5" step={name.includes('Hours') ? '0.5' : '0.01'} max={name.includes('Hours') ? 1000 : 999999}/></div>)}
      <Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save and prepare quote'}</Button>
    </form>}
    {error && <p role="status">{error}</p>}
  </div></EmployeeLayout>;
}
