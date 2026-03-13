import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Truck, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle2, 
  Navigation,
  Box
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LocalMovingPage() {
  const features = [
    {
      title: "Same-Day Availability",
      desc: "Need to move fast? In many of our 51 regions, we offer same-day service for local relocations.",
      icon: Clock
    },
    {
      title: "Full Assembly Service",
      desc: "Our teams don't just move boxes; they disassemble and reassemble furniture so you can settle in immediately.",
      icon: Box
    },
    {
      title: "Local Knowledge",
      desc: "With 1,000 movers per region, we know your neighborhood's parking rules, traffic patterns, and building requirements.",
      icon: MapPin
    },
    {
      title: "Premium Protection",
      desc: "Every local move includes standard valuation protection, with full-value replacement options available.",
      icon: ShieldCheck
    }
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Expert Local Logistics
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                YOUR LOCAL <span className="text-accent">MOVERS</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Stress-free relocation within your city or state. Wont Stop Moving provides the precision of a national logistics powerhouse with the care of a local neighbor.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Local Quote</Link>
              </Button>
            </div>
          </div>
          {/* Decorative Background Element */}
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Truck className="w-[600px] h-[600px]" />
          </div>
        </section>

        {/* Core Value Props */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, i) => (
                <div key={i} className="space-y-4 group">
                  <div className="bg-primary/5 p-4 rounded-2xl w-fit group-hover:bg-accent group-hover:text-white transition-colors">
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-primary uppercase">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Section: The Local Advantage */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-square relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/localmove/800/800" 
                    alt="Professional local moving crew" 
                    fill 
                    className="object-cover"
                    data-ai-hint="residential moving"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-accent p-8 rounded-3xl text-white shadow-xl">
                  <div className="text-4xl font-black">1M+</div>
                  <div className="text-xs font-bold uppercase tracking-widest">Local Moves Done</div>
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">THE <span className="text-accent">PRECISION</span> OF LOCAL LOGISTICS</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  A local move might seem simple, but the logistics of navigating urban density or suburban schedules requires expertise. Our teams in all 51 regions are background-checked, uniformed professionals trained in the specific challenges of their territory.
                </p>
                <div className="grid gap-4">
                  {[
                    "Hourly rates with no hidden fuel surcharges",
                    "Specialized protection for hardwood and carpets",
                    "Expertise in apartment and walk-up navigation",
                    "24/7 customer support for move-day adjustments"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Book Now</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Local Fleet Section */}
        <section className="py-24 bg-secondary text-white overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-4xl font-black uppercase mb-4">OUR LOCAL FLEET</h2>
              <p className="opacity-60">Equipped with air-ride suspension and GPS tracking, our local vehicles are designed to navigate tight city streets without compromising the safety of your assets.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Box Trucks", desc: "Perfect for 3-4 bedroom homes and large commercial units.", capacity: "26ft / 10,000 lbs" },
                { title: "City Shuttles", desc: "Designed for dense urban centers and narrow apartment complexes.", capacity: "16ft / 5,000 lbs" },
                { title: "Transit Vans", desc: "Ideal for small studio moves and single-item deliveries.", capacity: "10ft / 2,000 lbs" }
              ].map((truck, i) => (
                <Card key={i} className="bg-white/5 border-white/10 text-white overflow-hidden group hover:border-accent transition-all">
                  <CardContent className="p-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <Truck className="h-10 w-10 text-accent" />
                      <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded uppercase tracking-widest">{truck.capacity}</span>
                    </div>
                    <h3 className="text-2xl font-bold uppercase">{truck.title}</h3>
                    <p className="text-sm opacity-60 leading-relaxed">{truck.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Navigation className="h-16 w-16 mx-auto animate-bounce" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">READY FOR YOUR LOCAL JOURNEY?</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Join over 1 million happy customers who have moved across town with Wont Stop Moving.
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
              <Link href="/book">Book Now</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
