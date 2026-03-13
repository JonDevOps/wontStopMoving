import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar,
  MapPin,
  ArrowRight,
  FileText
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function MilitaryRelocationPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Service to our Service Members
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                MILITARY <span className="text-accent">PCS SUPPORT</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Relocating on orders requires a partner who understands the protocol. Wont Stop Moving provides specialized support for PCS moves across all 51 regions.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start PCS Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Shield className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "PCS Compliant", desc: "Documentation and invoicing designed for military reimbursement.", icon: FileText },
                { title: "Base Access", desc: "Teams vetted and approved for entry into secure military installations.", icon: ShieldCheck },
                { title: "Flexible Dates", desc: "We adjust our schedule to accommodate changing report dates.", icon: Calendar },
                { title: "Coast to Coast", desc: "Seamless coordination for moves between any of our 51 regional hubs.", icon: MapPin },
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
                    src="https://picsum.photos/seed/military/1200/800" 
                    alt="Military family moving" 
                    fill 
                    className="object-cover"
                    data-ai-hint="military family"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">HONORING YOUR <span className="text-accent">SERVICE</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Moving is a constant in military life. Our mission is to make your next PCS transition as smooth as possible, ensuring your household goods arrive safe and your family is settled quickly.
                </p>
                <div className="grid gap-4">
                  {[
                    "Detailed weight-verified documentation for claims",
                    "Direct communication with Move Coordinators",
                    "Specialized wrapping for sensitive military gear",
                    "Priority scheduling for service members"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Schedule PCS Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Shield className="h-16 w-16 mx-auto" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">THANK YOU FOR YOUR SERVICE</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              We are proud to serve the men and women who serve our country. Our teams are ready in all 51 regions.
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
