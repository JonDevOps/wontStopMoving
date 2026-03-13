import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  ClipboardCheck,
  ArrowRight,
  Gem
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function WhiteGlovePackingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Premium Care Standards
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                WHITE-GLOVE <span className="text-accent">PACKING</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                The ultimate convenience. We handle everything from wrapping fragile china to professional organization in your new home, ensuring your transition is seamless and stress-free.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Request Premium Pack</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Package className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Full Service", desc: "Every item in your home wrapped and boxed by trained professionals.", icon: Package },
                { title: "Fragile Expert", desc: "Specialized techniques for heirloom china, glass, and collectibles.", icon: Gem },
                { title: "Unpack & Organize", desc: "We don't just drop boxes; we place and organize items in your new space.", icon: Sparkles },
                { title: "Digital Inventory", desc: "Systematic labeling and photo documentation of all contents.", icon: ClipboardCheck },
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
                    src="https://picsum.photos/seed/packing/1200/800" 
                    alt="Professional packing service" 
                    fill 
                    className="object-cover"
                    data-ai-hint="professional packing"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">EXPERT <span className="text-accent">HANDLING</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Packing is an art. Our white-glove teams utilize premium acid-free materials and double-walled heavy-duty boxes to ensure every item—from your everyday essentials to your most prized possessions—is protected perfectly.
                </p>
                <div className="grid gap-4">
                  {[
                    "All high-quality packing materials included",
                    "Custom crating for non-standard or oversized items",
                    "Systematic room-by-room unpacking service",
                    "Professional furniture wrapping and padding"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Packing Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Sparkles className="h-16 w-16 mx-auto" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">STEP INTO A FINISHED HOME</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Our white-glove professionals ensure your transition is a celebration, not a chore. Available in all 51 regions.
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
