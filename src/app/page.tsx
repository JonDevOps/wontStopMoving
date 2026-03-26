import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Truck, 
  MapPin, 
  ShieldCheck, 
  ChevronRight, 
  Package, 
  Clock, 
  Warehouse, 
  ArrowRight
} from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { PublicLayout } from '@/components/layout/public-layout';

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg');
  
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="relative h-screen flex items-center overflow-hidden bg-primary pt-20">
          <div className="absolute inset-0 opacity-40">
            {heroImage && (
              <Image 
                src={heroImage.imageUrl} 
                alt={heroImage.description}
                fill
                className="object-cover"
                priority
                data-ai-hint={heroImage.imageHint}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
          </div>
          
          <div className="container relative mx-auto px-4 z-10">
            <div className="max-w-3xl">
              <h1 className="text-6xl md:text-8xl font-headline font-black text-white leading-tight mb-6 animate-fade-in animate-kinetic">
                MOVING MADE <span className="text-accent inline-block animate-float">SIMPLE</span>
              </h1>
              <p className="text-xl text-white/80 mb-10 max-w-xl leading-relaxed">
                Nationwide moving excellence across 50 states + Puerto Rico. 51,000+ professionals ready to handle your journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-8 h-16 text-lg font-bold shadow-xl shadow-accent/20">
                  <Link href="/quote">Get a Free Quote</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-white border-2 border-white/40 hover:border-white hover:bg-white/10 rounded-full px-8 h-16 text-lg font-bold">
                  <Link href="/login">Track My Move</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="bg-accent py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
              <div>
                <div className="text-4xl font-black font-headline">51,000+</div>
                <div className="text-sm uppercase tracking-widest opacity-80">Trained Professionals</div>
              </div>
              <div>
                <div className="text-4xl font-black font-headline">51</div>
                <div className="text-sm uppercase tracking-widest opacity-80">US Regions</div>
              </div>
              <div>
                <div className="text-4xl font-black font-headline">1m+</div>
                <div className="text-sm uppercase tracking-widest opacity-80">Moves Completed</div>
              </div>
              <div>
                <div className="text-4xl font-black font-headline">24/7</div>
                <div className="text-sm uppercase tracking-widest opacity-80">Support Availability</div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-primary">OUR SERVICES</h2>
              <div className="w-24 h-2 bg-accent mx-auto" />
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Local Moving", icon: Truck, desc: "Quick and efficient relocation within your city or state.", href: "/services/local-moving" },
                { title: "Long Distance", icon: MapPin, desc: "Nationwide service connecting all 50 states and Puerto Rico.", href: "/services/long-distance" },
                { title: "Commercial", icon: Warehouse, desc: "Specialized office and business relocation solutions.", href: "/services" },
                { title: "Packing Services", icon: Package, desc: "Professional packing with high-quality materials.", href: "/services" },
                { title: "Secure Storage", icon: ShieldCheck, desc: "Climate-controlled facilities for long or short term.", href: "/services" },
                { title: "Express Delivery", icon: Clock, desc: "Time-sensitive moving for urgent requirements.", href: "/services" }
              ].map((service, i) => (
                <Card key={i} className="group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-none overflow-hidden bg-white rounded-[2rem] shadow-sm">
                  <CardContent className="p-10">
                    <div className="bg-primary/5 p-5 rounded-2xl w-fit mb-8 group-hover:bg-accent group-hover:text-white transition-colors animate-float">
                      <service.icon className="h-10 w-10" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-primary">{service.title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{service.desc}</p>
                    <Link href={service.href} className="inline-flex items-center text-accent font-bold group-hover:gap-3 transition-all">
                      Learn More <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-16">
              <Button asChild variant="outline" className="rounded-full border-primary text-primary hover:bg-primary hover:text-white px-10 h-14 font-black uppercase tracking-widest text-xs transition-all">
                <Link href="/services">View All Services</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Coverage Map Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2">
                <h2 className="text-4xl md:text-5xl font-black mb-6 text-primary leading-tight">WE COVER <span className="text-accent">51 STATES + PUERTO RICO AND CANADA</span></h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  From the bustling streets of New York to the scenic landscapes of Puerto Rico, our network is ready. We have a dedicated team of 1,000 movers in every state, ensuring local expertise with nationwide standards.
                </p>
                <ul className="space-y-4 mb-10">
                  {['50 US States + Puerto Rico & Canada', 'Uniformed, background-checked staff', 'Real-time GPS truck tracking', 'Full valuation protection included'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium text-primary">
                      <div className="bg-accent rounded-full p-1"><ChevronRight className="h-4 w-4 text-white" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-8 text-white font-bold">
                  <Link href="/locations">Explore Coverage</Link>
                </Button>
              </div>
              <div className="lg:w-1/2 relative bg-gray-100 rounded-3xl p-8 overflow-hidden">
                 {/* Visual Placeholder for Map */}
                 <div className="aspect-[4/3] relative flex items-center justify-center">
                    <Image 
                      src="https://picsum.photos/seed/map/800/600"
                      alt="US Map Coverage"
                      width={800}
                      height={600}
                      className="rounded-xl shadow-inner opacity-20 grayscale"
                    />
                    <div className="absolute inset-0 flex flex-wrap gap-2 p-4 justify-center items-center">
                      {Array.from({length: 51}).map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl text-center">
                        <div className="text-3xl font-black text-primary">NATIONWIDE</div>
                        <div className="text-accent font-bold">100% Coverage Guaranteed</div>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer Section */}
        <section className="py-24 bg-secondary text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-black mb-8">READY TO START YOUR JOURNEY?</h2>
            <p className="text-xl opacity-80 mb-12 max-w-2xl mx-auto">
              Get an instant quote in minutes or join our growing team of 51,000 professionals.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-12 h-16 text-xl font-black shadow-xl shadow-accent/20">
                <Link href="/quote">BOOK MY MOVE</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white border-2 border-white/40 hover:border-white hover:bg-white/10 rounded-full px-12 h-16 text-xl font-black">
                <Link href="/careers">JOIN THE TEAM</Link>
              </Button>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -ml-48 -mb-48" />
        </section>
      </div>
    </PublicLayout>
  );
}
