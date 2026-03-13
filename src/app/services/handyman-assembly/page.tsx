import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Wrench, 
  ShieldCheck, 
  CheckCircle2, 
  Hammer,
  Home,
  ArrowRight,
  Tv
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function HandymanAssemblyPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Ready-to-Live Services
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                HANDYMAN & <span className="text-accent">ASSEMBLY</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                From assembling complex furniture to mounting TVs and hanging mirrors, our team ensures your new house feels like home on day one.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Request Assembly</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Wrench className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Furniture Assembly", desc: "Expert setup for IKEA, West Elm, and high-end modular furniture.", icon: Hammer },
                { title: "TV Mounting", desc: "Secure wall mounting and cable concealment for all screen sizes.", icon: Tv },
                { title: "Wall Hanging", desc: "Precision placement for mirrors, artwork, and gallery walls.", icon: Home },
                { title: "Shelving Units", desc: "Industrial and residential shelving installation for organization.", icon: Wrench },
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
                    src="https://picsum.photos/seed/handyman/1200/800" 
                    alt="Handyman assembling furniture" 
                    fill 
                    className="object-cover"
                    data-ai-hint="furniture assembly"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">SETTLED <span className="text-accent">ON DAY ONE</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Don't spend your first night in a sea of parts and instructions. Our handyman teams work alongside our movers to ensure your bed is assembled, your TV is mounted, and your home is fully functional before we leave.
                </p>
                <div className="grid gap-4">
                  {[
                    "Professional tools and mounting hardware included",
                    "Expertise in drywall, plaster, and masonry mounting",
                    "Cable management and wire concealment options",
                    "Uniformed, insured, and vetted handyman crews"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Book Handyman Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Wrench className="h-16 w-16 mx-auto" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">INSTANTLY AT HOME</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Our assembly professionals ensure your space is lived-in and comfortable from the moment you arrive. Available in all 51 regions.
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
