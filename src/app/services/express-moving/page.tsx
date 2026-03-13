import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Zap,
  Truck,
  ArrowRight,
  Navigation
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function ExpressMovingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Priority Transit Options
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                EXPRESS <span className="text-accent">MOVING</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                For when time is of the essence. Priority scheduling and dedicated transport for urgent relocation needs nationwide with guaranteed delivery dates.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Priority Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Clock className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Guaranteed Dates", desc: "Non-stop transit options with firm arrival windows.", icon: Clock },
                { title: "Priority Dispatch", desc: "Bypass the standard queue with our dedicated express fleet.", icon: Zap },
                { title: "24/7 Tracking", desc: "Real-time GPS telematics monitored by our dispatch center.", icon: Navigation },
                { title: "Last Minute", desc: "Emergency availability for same-day and next-day relocations.", icon: Truck },
              ].map((feature, i) => (
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

        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/express/1200/800" 
                    alt="Express moving truck on the road" 
                    fill 
                    className="object-cover"
                    data-ai-hint="fast moving truck"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">SPEED & <span className="text-accent">CERTAINTY</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  In our express service, your belongings are the only priority. We utilize dedicated vehicles and two-person driver teams to ensure your shipment moves non-stop from origin to destination across our 51 regions.
                </p>
                <div className="grid gap-4">
                  {[
                    "Direct, dedicated transport with no consolidated stops",
                    "Priority loading and unloading at both locations",
                    "Advanced route optimization for fastest transit",
                    "Dedicated Move Coordinator for constant updates"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Priority Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Zap className="h-16 w-16 mx-auto" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">MOTION AT SCALE</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              When your move can't wait, our express teams are ready in all 51 regions to bridge the distance.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
                <Link href="/book">Book Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
