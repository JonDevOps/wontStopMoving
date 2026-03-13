import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Building2,
  Users,
  Navigation
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function CommercialMovingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Enterprise Logistics
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                BUSINESS IN <span className="text-accent">MOTION</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Relocating your business requires precision and zero downtime. Wont Stop Moving provides scalable commercial logistics for startups and global headquarters alike.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Commercial Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Building2 className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Zero Downtime", desc: "After-hours and weekend moving schedules to ensure business continuity.", icon: Clock },
                { title: "IT Specialists", desc: "Expert handling of servers, workstations, and complex network infrastructure.", icon: Briefcase },
                { title: "Modular Setup", desc: "Professional disassembly and reconfiguration of modular office furniture.", icon: Building2 },
                { title: "Project Management", desc: "A dedicated project manager for every commercial transition.", icon: Users },
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
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/commmove/1200/800" 
                    alt="Modern office being moved" 
                    fill 
                    className="object-cover"
                    data-ai-hint="office interior"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">ENTERPRISE <span className="text-accent">PRECISION</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Every commercial move is a logistical operation where time is the most valuable asset. We coordinate with facility managers, building security, and your IT department to ensure a seamless handoff.
                </p>
                <div className="grid gap-4">
                  {[
                    "Certificate of Insurance (COI) provided for all buildings",
                    "Labeling systems for systematic workstation delivery",
                    "Asset decommissioning and recycling services",
                    "Secure documentation and file transport"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Move Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Navigation className="h-16 w-16 mx-auto" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">READY TO EVOLVE YOUR SPACE?</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Our commercial teams are active in all 51 regions, ready to scale with your business growth.
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
