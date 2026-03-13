import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  Recycle,
  Truck,
  ArrowRight,
  Leaf
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function JunkRemovalPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Responsible Decluttering
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                JUNK <span className="text-accent">REMOVAL</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Declutter your life before or after the move. We'll haul away unwanted items and ensure they're donated or recycled responsibly across our 51 regions.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Request Removal</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Trash2 className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Same-Day Haul", desc: "Quick response teams to clear space before our movers arrive.", icon: Truck },
                { title: "Eco-Friendly", desc: "We prioritize recycling and responsible disposal for all junk.", icon: Leaf },
                { title: "Donation Assist", desc: "Delivery of reusable items to local charities with receipts provided.", icon: Recycle },
                { title: "Full Clear", desc: "Removal from attics, basements, and garages with no heavy lifting for you.", icon: Trash2 },
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
                    src="https://picsum.photos/seed/junk/1200/800" 
                    alt="Decluttered garage after junk removal" 
                    fill 
                    className="object-cover"
                    data-ai-hint="waste disposal"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">LIGHTER <span className="text-accent">MOVE</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  The less you move, the lower your quote. Our junk removal teams help you purge unwanted furniture, electronics, and household items, making your actual move faster, cheaper, and more organized.
                </p>
                <div className="grid gap-4">
                  {[
                    "Transparent pricing based on volume",
                    "E-waste recycling for old electronics",
                    "Responsible hazardous material referral",
                    "Uniformed, background-checked removal crews"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Book Removal Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Leaf className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">CLEAR THE CLUTTER</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our removal experts ensure your home is light, organized, and ready for its next chapter. Available in all 51 regions.
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
