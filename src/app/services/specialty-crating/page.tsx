import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Hammer, 
  ShieldCheck, 
  CheckCircle2, 
  Lock,
  Boxes,
  ArrowRight,
  Gem
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function SpecialtyCratingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Museum-Grade Protection
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                SPECIALTY <span className="text-accent">CRATING</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Custom-built wooden crates for high-value items like fine art, antiques, and large electronics. We ensure maximum protection during transit with industrial-grade engineering.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Request Crate Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Hammer className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Custom Built", desc: "Every crate is engineered on-site to the exact dimensions of your item.", icon: Hammer },
                { title: "Fine Art Pros", desc: "Archival-grade materials and handling for paintings and sculptures.", icon: Gem },
                { title: "Shock Absorb", desc: "Internal bracing and shock-absorbent platforms for electronics.", icon: Boxes },
                { title: "Secure Transit", desc: "Direct, non-stop transit options for your most valuable assets.", icon: Lock },
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
                    src="https://picsum.photos/seed/crating/1200/800" 
                    alt="Wooden crate for high-value items" 
                    fill 
                    className="object-cover"
                    data-ai-hint="wooden crate"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">ENGINEERED <span className="text-accent">SAFETY</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Some items are simply too valuable or fragile for standard boxes. Our specialty crating teams analyze the center of gravity and fragility of your item to build a protective exoskeleton that guarantees safety during cross-country transit.
                </p>
                <div className="grid gap-4">
                  {[
                    "On-site custom crate construction and assembly",
                    "ISPM-15 certified wood for international transit",
                    "Vapor-barrier wrapping for humidity control",
                    "End-to-end chain of custody and security"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Crate Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Lock className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">PROTECTING THE PRICELESS</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our specialized crating teams are active in all 51 regions, bringing museum-quality standards to your home or gallery.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
                <Link href="/book">Book Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
