import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  Hammer,
  Truck,
  ArrowRight,
  Anchor
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function GunSafeMovingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Specialized Handling
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                SECURE ASSET <span className="text-accent">TRANSPORT</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Moving high-capacity gun safes requires more than just muscle. We utilize industrial-grade equipment and specialized training to ensure your secure storage is relocated without damage.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Get Safe Moving Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Lock className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Motorized Dollies", desc: "Stair-climbing technology that prevents floor and wall damage.", icon: Anchor },
                { title: "Discreet Service", desc: "Professional and low-profile transport options for your privacy.", icon: Lock },
                { title: "Floor Protection", desc: "Industrial-grade runners and protection for hardwood and tile.", icon: ShieldCheck },
                { title: "Bolt-Down Service", desc: "Expert anchoring at your new location for immediate security.", icon: Hammer },
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
                    src="https://picsum.photos/seed/gunsafe/800/800" 
                    alt="Heavy safe being moved" 
                    fill 
                    className="object-cover"
                    data-ai-hint="heavy vault"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">HEAVY-DUTY <span className="text-accent">PRECISION</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Safes ranging from 500 lbs to over 2,000 lbs require a specific logistical plan. Our teams analyze path weight-bearing capacity and utilize specialized equipment to distribute weight evenly.
                </p>
                <div className="grid gap-4">
                  {[
                    "Weight distribution analysis for flooring",
                    "Specialized motorized stair-climbing equipment",
                    "Custom crating for high-value vault finishes",
                    "Direct transport with real-time GPS tracking"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Schedule Safe Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Truck className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">SECURE YOUR TRANSITION</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our 51,000 movers include specialized heavy-haul experts trained in safe and vault relocation protocols.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl">
                <Link href="/quote">GET INSTANT QUOTE</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
