import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Home, 
  Building2, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle2, 
  Lock,
  ArrowRight
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function TypesOfMovesPage() {
  const categories = [
    {
      title: "Residential Moves",
      icon: Home,
      desc: "Whether it's a high-rise apartment in New York or a suburban home in Texas, we handle every detail of your home transition with care.",
      items: ["Single Family Homes", "Apartments & Condos", "Townhomes", "Studio Relocation"]
    },
    {
      title: "Commercial & Office",
      icon: Building2,
      desc: "Minimize downtime with our efficient business logistics. We handle everything from startups to massive corporate headquarters.",
      items: ["Office Relocation", "Retail Moves", "Warehouse Logistics", "Data Center Moving"]
    },
    {
      title: "Specialized Relocation",
      icon: ShieldCheck,
      desc: "Moves that require specific protocols, background checks, or unique sensitivity across our 51 nationwide regions.",
      items: ["Military PCS Support", "Senior Transitions", "Student Moving", "Hospitality FF&E"]
    },
    {
      title: "High-Value & Specialty",
      icon: Lock,
      desc: "Precision handling for your most valuable and heavy assets, utilizing industrial-grade protection and specialized dollies.",
      items: ["Piano Moving", "Gun Safe Moving", "Fine Art & Antiques", "IT Infrastructure"]
    }
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
              Custom Relocation Solutions
            </div>
            <h1 className="text-5xl md:text-8xl font-black mb-6 uppercase tracking-tighter leading-tight">
              TYPES OF <span className="text-accent">MOVES</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Every relocation is unique. From residential transitions to complex commercial logistics, we tailor our nationwide network to fit your specific needs.
            </p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent opacity-30" />
        </section>

        {/* Categories Grid */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8">
              {categories.map((cat, i) => (
                <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-gray-50">
                  <CardContent className="p-10 flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="bg-primary text-white p-4 rounded-2xl group-hover:bg-accent transition-colors">
                        <cat.icon className="h-8 w-8" />
                      </div>
                      <h2 className="text-3xl font-black text-primary uppercase">{cat.title}</h2>
                    </div>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                      {cat.desc}
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      {cat.items.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm font-bold text-primary">
                          <ChevronRight className="h-4 w-4 text-accent" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Breakdown Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/typesmove/1200/800" 
                    alt="Various types of moves" 
                    fill 
                    className="object-cover"
                    data-ai-hint="moving truck"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">NATIONWIDE <span className="text-accent">VERSATILITY</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  With 51,000 movers across all 51 regions, we have the specialized talent required for any scenario. Whether you're moving a single piano across town or relocating an entire corporate headquarters across state lines, our standards remain consistent.
                </p>
                <div className="space-y-4">
                  {[
                    { title: "Local Relocation", desc: "Short-distance moves within our 51 regional zones." },
                    { title: "Long-Distance Transit", desc: "Cross-country logistics with real-time GPS tracking." },
                    { title: "White-Glove Handling", desc: "Premium packing and organization for delicate estates." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="bg-accent/10 p-2 rounded-lg h-fit text-accent">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary text-white text-center">
          <div className="container mx-auto px-4 space-y-8">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">WHAT ARE WE MOVING?</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our AI-driven quoting system accounts for the specific nuances of your move type to provide the most accurate estimate in the industry.
            </p>
            <div className="flex justify-center gap-6">
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
