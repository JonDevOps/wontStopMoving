import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { CalendarClock, PhoneCall, ShieldCheck, Warehouse } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Moving Company Closed or Cancelled? We Can Help',
  description: 'If your moving company went out of business, cancelled, or stopped answering, Wont Stop Moving can step in fast with licensed, insured, vetted movers. Get a quote today.',
  alternates: { canonical: '/mover-closed' },
};

const STEPS = [
  { icon: PhoneCall, title: 'Call or request a quote', text: 'Tell us your date, addresses and what happened. We prioritize moves that fell through.' },
  { icon: CalendarClock, title: 'Keep your date when we can', text: 'We work with a network of vetted movers, so we can often cover dates on short notice.' },
  { icon: Warehouse, title: 'Belongings in their storage?', text: 'Tell us where they are. We’ll help you get them released and moved.' },
  { icon: ShieldCheck, title: 'Licensed and insured', text: 'Every mover we send is checked against federal records, every day.' },
];

export default function MoverClosedPage() {
  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 space-y-10">
        <header className="text-center space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-accent">Your move fell through?</p>
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Your moving company closed or cancelled. <span className="text-accent">We’ve got you.</span></h1>
          <p className="text-lg text-muted-foreground">Moving companies sometimes shut down, lose their license, or stop answering, often right before moving day. We step in fast.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="font-black uppercase"><Link href="/quote?utm_source=mover-closed&utm_medium=landing&utm_campaign=stranded">Get a quote now</Link></Button>
            <Button asChild size="lg" variant="outline" className="font-black uppercase"><a href="tel:+14152145474">Call (415) 214-5474</a></Button>
          </div>
        </header>
        <section className="grid sm:grid-cols-2 gap-4">
          {STEPS.map(s => <div key={s.title} className="bg-white rounded-3xl p-6 space-y-2"><s.icon className="h-7 w-7 text-accent" /><h2 className="font-black text-primary">{s.title}</h2><p className="text-sm text-muted-foreground">{s.text}</p></div>)}
        </section>
        <section className="bg-white rounded-3xl p-6 space-y-3">
          <h2 className="text-xl font-black text-primary">If you paid a deposit</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
            <li>If you paid by credit card, contact your card company about a chargeback for services not provided.</li>
            <li>For an interstate move, file a complaint with FMCSA’s National Consumer Complaint Database (1-888-368-7238).</li>
            <li>For a move within your state, contact your state’s moving regulator or attorney general.</li>
          </ul>
          <p className="text-sm text-muted-foreground">Not sure if a company is licensed? <Link className="underline" href="/check-a-mover">Check any mover here</Link>.</p>
        </section>
      </div>
    </div>
  </PublicLayout>;
}
