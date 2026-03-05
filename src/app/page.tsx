import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Truck, 
  MapPin, 
  ShieldCheck, 
  Users, 
  ChevronRight,
  Package,
  Clock,
  Warehouse,
  ArrowRight
} from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg');
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-white p-2 rounded-lg">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-xl font-headline font-extrabold uppercase tracking-tighter text-primary">
              Wont Stop <span className="text-accent">Moving</span>
            </span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/services" className="text-sm font-bold hover:text-accent transition-colors">Services</Link>
            <Link href="/about" className="text-sm font-bold hover:text-accent transition-colors">About</Link>
            <Link href="/careers" className="text-sm font-bold hover:text-accent transition-colors">Careers</Link>
            <Link href="/contact" className="text-sm font-bold hover:text-accent transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:flex rounded-full text-primary font-bold hover:bg-primary/5">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Link href="/quote">Get a Quote</Link>
            </Button>
          </div>
        </div>
      </header>

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
            <h1 className="text-6xl md:text-8xl font-headline font-black text-white leading-tight mb-6 animate-fade-in">
              MOVING MADE <span className="text-accent">SIMPLE</span>
            </h1>
            <p className="text-xl text-white/80 mb-10 max-w-xl leading-relaxed">
              Nationwide moving excellence across 50 states + Puerto Rico. 51,000 professional movers ready to handle your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-8 text-lg font-bold">
                <Link href="/quote">Get a Free Quote</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-primary rounded-full px-8 text-lg font-bold">
                <Link href="/track">Track My Move</Link>
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
              <div className="text-sm uppercase tracking-widest opacity-80">Trained Movers</div>
            </div>
            <div>
              <div className="text-4xl font-black font-headline">51</div>
              <div className="text-sm uppercase tracking-widest opacity-80">US Regions</div>
            </div>
            <div>
              <div className="text-4xl font-black font-headline">100k+</div>
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
              { title: "Local Moving", icon: Truck, desc: "Quick and efficient relocation within your city or state." },
              { title: "Long Distance", icon: MapPin, desc: "Nationwide service connecting all 50 states and Puerto Rico." },
              { title: "Commercial", icon: Warehouse, desc: "Specialized office and business relocation solutions." },
              { title: "Packing Services", icon: Package, desc: "Professional packing with high-quality materials." },
              { title: "Secure Storage", icon: ShieldCheck, desc: "Climate-controlled facilities for long or short term." },
              { title: "Express Delivery", icon: Clock, desc: "Time-sensitive moving for urgent requirements." }
            ].map((service, i) => (
              <Card key={i} className="group hover:shadow-xl transition-all border-none overflow-hidden">
                <CardContent className="p-8">
                  <div className="bg-primary/5 p-4 rounded-2xl w-fit mb-6 group-hover:bg-accent group-hover:text-white transition-colors">
                    <service.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-primary">{service.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">{service.desc}</p>
                  <Link href="/services" className="inline-flex items-center text-accent font-bold group-hover:gap-3 transition-all">
                    Learn More <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage Map Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <h2 className="text-4xl md:text-5xl font-black mb-6 text-primary leading-tight">WE COVER ALL <span className="text-accent">51 REGIONS</span></h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                From the bustling streets of New York to the scenic landscapes of Puerto Rico, our network is ready. We have a dedicated team of 1,000 movers in every state, ensuring local expertise with nationwide standards.
              </p>
              <ul className="space-y-4 mb-10">
                {['50 US States + Puerto Rico', 'Uniformed, background-checked staff', 'Real-time GPS truck tracking', 'Full valuation protection included'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium text-primary">
                    <div className="bg-accent rounded-full p-1"><ChevronRight className="h-4 w-4 text-white" /></div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-8">
                <Link href="/about">Explore Coverage</Link>
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
            Get an instant quote in minutes or join our growing team of 51,000 professional movers.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-12 h-16 text-xl font-black">
              <Link href="/quote">BOOK MY MOVE</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white hover:bg-white hover:text-primary rounded-full px-12 h-16 text-xl font-black">
              <Link href="/careers">JOIN THE TEAM</Link>
            </Button>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -ml-48 -mb-48" />
      </section>

      {/* Footer */}
      <footer className="bg-primary pt-20 pb-10 text-white/60 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-6 text-white">
                <Truck className="h-6 w-6 text-accent" />
                <span className="text-xl font-headline font-black uppercase tracking-tighter">
                  Wont Stop <span className="text-accent">Moving</span>
                </span>
              </Link>
              <p className="text-sm leading-relaxed mb-6">
                Redefining the moving experience with technology and transparency. Serving all 50 states and Puerto Rico with unparalleled reliability.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/about" className="hover:text-accent transition-colors">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-accent transition-colors">Careers</Link></li>
                <li><Link href="/services" className="hover:text-accent transition-colors">Our Services</Link></li>
                <li><Link href="/press" className="hover:text-accent transition-colors">Press & Media</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Support</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/contact" className="hover:text-accent transition-colors">Contact Us</Link></li>
                <li><Link href="/faq" className="hover:text-accent transition-colors">FAQ</Link></li>
                <li><Link href="/track" className="hover:text-accent transition-colors">Track Move</Link></li>
                <li><Link href="/insurance" className="hover:text-accent transition-colors">Insurance Info</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Regional Offices</h4>
              <p className="text-sm leading-relaxed mb-4">
                Headquarters: 123 Momentum Way, Dallas, TX 75201
              </p>
              <p className="text-sm font-bold text-white mb-2">1-800-MOVE-NOW</p>
              <p className="text-sm">support@wontstopmoving.com</p>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>© 2024 Wont Stop Moving Inc. Licensed & Insured DOT #1234567.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/accessibility" className="hover:text-white transition-colors">Accessibility</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
