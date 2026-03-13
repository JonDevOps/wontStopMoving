import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Wrench, 
  CheckCircle2, 
  LayoutDashboard,
  Users,
  Warehouse,
  Boxes
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function WorkplaceSolutionsPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Workplace Evolution
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                WORKPLACE <span className="text-accent">SOLUTIONS</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                From decommission to design, we manage the complete lifecycle of your modern workspace. We help organizations configure environments that foster collaboration and growth.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Solution Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <LayoutDashboard className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Asset Decomm", desc: "Systematic dismantling and removal of legacy office assets.", icon: Wrench },
                { title: "Space Planning", desc: "Collaborative design services to optimize your new office layout.", icon: LayoutDashboard },
                { title: "Config Support", desc: "Expert furniture reconfiguration for hybrid and collaborative teams.", icon: Users },
                { title: "Vaulted Storage", desc: "Secure inventory management for transitional or seasonal furniture.", icon: Warehouse },
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
                    src="https://picsum.photos/seed/workplace/800/800" 
                    alt="Modern collaborative workspace" 
                    fill 
                    className="object-cover"
                    data-ai-hint="modern office"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">END-TO-END <span className="text-accent">MANAGEMENT</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Relocating an office is an opportunity to redefine your culture. We handle the heavy lifting of the transition so you can focus on your people. Our nationwide network ensures consistency across all your regional hubs.
                </p>
                <div className="grid gap-4">
                  {[
                    "Procurement support for new office furniture",
                    "Eco-friendly disposal and recycling of decommissioned assets",
                    "Real-time inventory management via our client portal",
                    "Phased rollouts for multi-site corporate accounts"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Explore Solutions</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Boxes className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">FUTURE-PROOF YOUR OFFICE</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our 51 regions provide the scale and flexibility needed for global workplace rollouts.
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
