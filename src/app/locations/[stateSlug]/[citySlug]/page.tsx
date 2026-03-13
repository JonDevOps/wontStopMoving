import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowLeft, Truck, ShieldCheck, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function CityPage({ params }: { params: Promise<{ stateSlug: string, citySlug: string }> }) {
  const { stateSlug, citySlug } = await params;

  const formatTitle = (slug: string) => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const cityName = formatTitle(citySlug);
  const stateName = formatTitle(stateSlug);

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <Link 
              href={`/locations/${stateSlug}`} 
              className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to {stateName}
            </Link>

            <div className="text-center space-y-6 animate-fade-in">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                <MapPin className="h-3 w-3 fill-current" />
                Local Service Center
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-primary uppercase tracking-tighter leading-[0.9] break-words">
                {cityName}, <br className="sm:hidden" /> <span className="text-accent">{stateName}</span>
              </h1>
              <p className="text-xl md:text-2xl font-bold text-primary/80 max-w-2xl mx-auto leading-relaxed">
                Proudly servicing {cityName} and the surrounding areas.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-16">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-6 group hover:-translate-y-1 transition-all duration-300">
                <div className="bg-primary/5 p-4 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Truck className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-primary uppercase">Ready to Move?</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed text-balance">Lock in your guaranteed moving date with our professional {cityName} crew.</p>
                </div>
                <Button asChild className="w-full bg-primary hover:bg-primary/90 h-14 rounded-xl text-lg font-bold">
                  <Link href="/book">Book Now</Link>
                </Button>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-6 group hover:-translate-y-1 transition-all duration-300">
                <div className="bg-accent/5 p-4 rounded-2xl text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                  <ShieldCheck className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-primary uppercase">Need a Price?</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed text-balance">Get a detailed, binding estimate for your {cityName} relocation in minutes.</p>
                </div>
                <Button asChild className="w-full bg-accent hover:bg-accent/90 h-14 rounded-xl text-lg font-bold">
                  <Link href="/quote">Request Quote</Link>
                </Button>
              </div>
            </div>

            <div className="bg-primary text-white p-12 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="relative z-10 grid md:grid-cols-3 gap-12 text-center">
                <div className="space-y-2">
                  <Clock className="h-8 w-8 text-accent mx-auto mb-4" />
                  <h4 className="text-2xl font-black uppercase">24/7</h4>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Local Support</p>
                </div>
                <div className="space-y-2">
                  <MapPin className="h-8 w-8 text-accent mx-auto mb-4" />
                  <h4 className="text-2xl font-black uppercase">GPS</h4>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Real-Time Tracking</p>
                </div>
                <div className="space-y-2">
                  <ShieldCheck className="h-8 w-8 text-accent mx-auto mb-4" />
                  <h4 className="text-2xl font-black uppercase">100%</h4>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Bonded & Insured</p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
            </div>

            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl mx-auto">
                Moving to or from {cityName}? Our {stateName} regional hub provides full-service packing, 
                secure storage, and nationwide transit for any scale of residential or commercial relocation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
