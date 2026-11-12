'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const TOPICS = ['My booking or move date', 'Payment or refund', 'Change or cancel my move', 'Damage or missing item', 'My quote', 'Something else'];

/** "Get help": sends a ticket to the support inbox, prefilled for signed-in customers; visitors add their name and email. */
export function SupportDialog({ name, email, phone }: { name?: string; email?: string | null; phone?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [tel, setTel] = useState(phone || '');
  const [busy, setBusy] = useState(false);
  // Signed-out visitors type their own name and email.
  const guest = !email;
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: (guest ? guestName : name || email || 'Customer').slice(0, 120), email: guest ? guestEmail : email, phone: tel, subject: `[${guest ? 'Website' : 'Dashboard'}] ${topic}`, message, website: '' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not send your message.');
      toast({ title: 'Message sent', description: 'We usually reply within one business day. For anything urgent on moving day, call us.' });
      setMessage(''); setOpen(false);
    } catch (err) { toast({ variant: 'destructive', title: 'Couldn’t send', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" aria-label="Get help" className="rounded-full font-bold gap-1"><LifeBuoy className="h-4 w-4" /><span className="hidden sm:inline">Get help</span></Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>How can we help?</DialogTitle><DialogDescription>Send us a message and our team will reply by email. Moving today? Call <a className="underline" href="tel:+14152145474">(415) 214-5474</a>.</DialogDescription></DialogHeader>
      <form onSubmit={send} className="space-y-3">
        <select aria-label="Topic" className="w-full h-10 border rounded-md px-2 bg-white text-sm" value={topic} onChange={e => setTopic(e.target.value)}>{TOPICS.map(t => <option key={t}>{t}</option>)}</select>
        {guest && <div className="grid sm:grid-cols-2 gap-2">
          <Input required minLength={2} placeholder="Your name" value={guestName} onChange={e => setGuestName(e.target.value)} aria-label="Your name" />
          <Input required type="email" placeholder="Email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} aria-label="Email" />
        </div>}
        <Textarea required minLength={10} rows={5} placeholder="Tell us what’s going on (include your move date if it’s about a move)." value={message} onChange={e => setMessage(e.target.value)} aria-label="Your message" />
        <Input placeholder="Phone (optional)" value={tel} onChange={e => setTel(e.target.value)} aria-label="Phone" />
        <Button type="submit" className="w-full" disabled={busy || message.trim().length < 10 || (guest && (guestName.trim().length < 2 || !guestEmail.includes('@')))}>{busy ? 'Sending…' : 'Send message'}</Button>
        <p className="text-xs text-muted-foreground flex flex-wrap gap-3"><a className="underline inline-flex items-center gap-1" href="tel:+14152145474"><Phone className="h-3 w-3" />Call us</a><Link className="underline" href={guest ? '/cancel' : '/dashboard/customer/moves'}>Change, cancel or report damage on a move</Link></p>
      </form>
    </DialogContent>
  </Dialog>;
}
