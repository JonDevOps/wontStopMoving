import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Globe, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle2, 
  Navigation,
  Clock,
  Zap,
  Phone
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LongDistanceMovingPage() {
  const features = [
    {
      title: "Nationwide Fleet",
      desc: "Our 26-foot national fleet is optimized for long-haul stability with air-ride suspension systems.",
      icon: Truck
    },
    {
      title: "Real-Time Tracking",
      desc: "Monitor your shipment's journey across state lines with 24/7 GPS telematics via our customer portal.",
      icon: Navigation
    },
    {
      title: "51-Region Support",
      desc: "We have established logistics hubs in all 50 states and Puerto Rico, ensuring local support everywhere.",
      icon: Globe
    },
    {
      title: "Binding Estimates",
      desc: "We provide Binding Not-to-Exceed quotes, ensuring your long-distance budget remains predictable.",
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
                Nationwide Relocation Experts
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                LONG DISTANCE <span className="text-accent">LOGISTICS</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Moving across the country requires more than a truck—it requires a masterclass in logistics. We manage the complexities of state-to-state transitions with unparalleled precision.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start National Quote</Link>
              </Button>
            </div>
          </div>
          {/* Decorative Background Element */}
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Globe className="w-[600px] h-[600px]" />
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

        {/* Detailed Section: The Long Haul Advantage */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://images.unsplash.com/photo-1640328441917-6e8c1245791a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxoaWdod2F5JTIwcm9hZHxlbnwwfHx8fDE3NzI1NDc0NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                    alt="Highway road representing long distance" 
                    fill 
                    className="object-cover"
                    data-ai-hint="highway road"
                  />
                </div>
                <div className="absolute -bottom-6 -left-6 bg-primary p-8 rounded-3xl text-white shadow-xl">
                  <div className="text-4xl font-black">50+</div>
                  <div className="text-xs font-bold uppercase tracking-widest">States & PR Covered</div>
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">BEYOND <span className="text-accent">STATE LINES</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Long-distance moving is an evolution of your life. At Wont Stop Moving, we assign a dedicated Move Coordinator to every nationwide shipment. They serve as your single point of contact, managing the timeline, documentation, and regional handoffs.
                </p>
                <div className="grid gap-4">
                  {[
                    "Guaranteed delivery windows for cross-country routes",
                    "Custom crating for high-value assets in transit",
                    "Climate-controlled vaulted storage for delayed closings",
                    "Full coordination of vehicle transport services"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/services/types-of-moves">See All Move Types</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Split Section: PR & Coastal Logistics */}
        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center">
                <h2 className="text-4xl font-black uppercase mb-4 tracking-tighter">COASTAL & <span className="text-accent">ISLAND</span> LOGISTICS</h2>
                <p className="opacity-60 text-lg">Moving to Puerto Rico or along the coast requires specialized moisture defense and sea-freight coordination.</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-white/5 border-white/10 text-white overflow-hidden group hover:border-accent transition-all">
                  <CardContent className="p-8 space-y-4">
                    <Zap className="h-10 w-10 text-accent" />
                    <h3 className="text-2xl font-bold uppercase">Express Sea-Freight</h3>
                    <p className="text-sm opacity-60 leading-relaxed">Dedicated ocean container booking and Hacienda documentation support for seamless entry into Puerto Rico.</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 text-white overflow-hidden group hover:border-accent transition-all">
                  <CardContent className="p-8 space-y-4">
                    <ShieldCheck className="h-10 w-10 text-accent" />
                    <h3 className="text-2xl font-bold uppercase">Coastal Shield</h3>
                    <p className="text-sm opacity-60 leading-relaxed">Specialized moisture-barrier wrapping for all furniture to protect against salt air and high-humidity coastal transit.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Globe className="h-16 w-16 mx-auto animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">READY TO MOVE NATIONWIDE?</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Get an instant, professional estimate for your long-distance relocation today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl">
                <Link href="/quote">GET INSTANT QUOTE</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white border-2 border-white/40 hover:border-white hover:bg-white/10 rounded-full px-12 h-16 text-xl font-bold">
                <Link href="/contact"><Phone className="mr-2 h-5 w-5" /> TALK TO COORDINATOR</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
