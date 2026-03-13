import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Hotel, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Building2,
  Trash2,
  Box
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function HospitalityServicesPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Hospitality Logistics
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                HOSPITALITY <span className="text-accent">FF&E</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Comprehensive FF&E (Furniture, Fixtures & Equipment) logistics for hotels, resorts, and restaurants. We manage high-volume transitions with unmatched precision.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Project Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Hotel className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "FF&E Install", desc: "Expert installation teams for guest rooms, lobbies, and dining areas.", icon: Hotel },
                { title: "Model Room Setup", desc: "Precision assembly for design validation and prototype rooms.", icon: Box },
                { title: "Liquidation", desc: "Systematic removal and responsible disposal or recycling of old assets.", icon: Trash2 },
                { title: "Project Handoff", desc: "Phased logistics to align with your construction and opening schedule.", icon: Clock },
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
                <div className="aspect-square relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/hotel/800/800" 
                    alt="Hotel lobby being outfitted" 
                    fill 
                    className="object-cover"
                    data-ai-hint="hotel interior"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">SERVICE <span className="text-accent">STANDARDS</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  The hospitality industry demands a "white-glove" standard at an industrial scale. Our teams coordinate with general contractors and interior designers to ensure every lamp, desk, and headboard is perfectly placed.
                </p>
                <div className="grid gap-4">
                  {[
                    "Asset inventory and barcode tracking for every unit",
                    "Customized reporting for multi-phase hospitality projects",
                    "Nationwide warehousing for deferred opening dates",
                    "Discreet, uniformed professionals for active properties"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Coordinate Project</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Building2 className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">NATIONWIDE HOSPITALITY SCALE</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              With 1,000 movers in every state, we have the volume and regional expertise to handle your largest resort rollout.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl">
                <Link href="/quote">GET PROJECT QUOTE</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
