import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Globe2, Truck, Warehouse, ShieldCheck, Handshake, Route } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Agent Network for Moving Companies',
  description: 'Established moving companies across the United States, Canada and Mexico: join the Wont Stop Moving agent network as an origin, destination, hauling or storage agent.',
  alternates: { canonical: '/agents' },
};

const STEPS = [
  { icon: Handshake, title: 'Apply', text: 'Tell us about your company: operating authority, insurance, fleet, warehouse and the areas you serve.' },
  { icon: ShieldCheck, title: 'Get vetted', text: 'We verify your authority and insurance, check references and reviews, and confirm your facility.' },
  { icon: Route, title: 'Take shipments', text: 'Accept origin, destination, hauling and storage work on moves we book, and hand off to other vetted agents.' },
];
const BENEFITS = [
  'Booked, prepaid moves in your area without buying leads',
  'Keep your own brand and local business',
  'Partner with vetted agents at the other end of every long-distance move',
  'One dashboard for shipments, handoffs and the network directory',
];

export default function AgentsPage() {
  return <PublicLayout>
    <div className="pt-32 pb-24 bg-gray-50">
      <div className="container mx-auto px-4 max-w-5xl space-y-16">
        <section className="text-center space-y-6">
          <div className="mx-auto bg-primary text-white p-4 rounded-3xl w-fit"><Globe2 className="h-10 w-10" /></div>
          <h1 className="text-4xl sm:text-6xl font-black text-primary uppercase tracking-tighter">The Wont Stop Moving <span className="text-accent">Agent Network</span></h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">A network of established, locally owned moving companies across North America. You handle the move in your market; vetted partners handle the other end.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="rounded-xl font-black uppercase"><Link href="/agents/apply">Apply to join</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl font-black uppercase"><Link href="/login?role=agent">Agent sign in</Link></Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => <div key={s.title} className="bg-white rounded-3xl p-8 shadow-sm space-y-3">
            <s.icon className="h-8 w-8 text-accent" />
            <h2 className="text-xl font-black uppercase">{i + 1}. {s.title}</h2>
            <p className="text-muted-foreground">{s.text}</p>
          </div>)}
        </section>

        <section className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <h2 className="text-3xl font-black uppercase text-primary">Who we’re looking for</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3"><Truck className="h-5 w-5 text-accent shrink-0" />Moving companies with their own trucks and trained crews</li>
              <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-accent shrink-0" />Active operating authority (USDOT/MC in the US, provincial or federal registration in Canada and Mexico) and cargo and liability insurance</li>
              <li className="flex gap-3"><Warehouse className="h-5 w-5 text-accent shrink-0" />A local office, and ideally warehouse space for storage-in-transit</li>
            </ul>
          </div>
          <div className="bg-slate-900 text-white rounded-3xl p-8 space-y-4">
            <h2 className="text-2xl font-black uppercase">Why join</h2>
            <ul className="space-y-2 list-disc pl-5 text-slate-300">{BENEFITS.map(b => <li key={b}>{b}</li>)}</ul>
            <p className="text-sm text-slate-400">Questions? Call <a className="underline" href="tel:+14152145474">(415) 214-5474</a>.</p>
          </div>
        </section>
      </div>
    </div>
  </PublicLayout>;
}
