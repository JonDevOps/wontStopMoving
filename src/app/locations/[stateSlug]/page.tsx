"use client";

import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Search, MapPin, ArrowLeft, Globe } from 'lucide-react';
import Link from 'next/link';
import { useState, use } from 'react';
import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';

export default function StatePage({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = use(params);
  const [search, setSearch] = useState('');

  const formatTitle = (slug: string) => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const stateName = formatTitle(stateSlug);
  const cities = CITIES_BY_STATE[stateSlug.toLowerCase()] || [];
  const filteredCities = cities.filter(city => city.toLowerCase().includes(search.toLowerCase()));

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            <Link 
              href="/locations" 
              className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Locations
            </Link>

            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                <MapPin className="h-3 w-3 fill-current" />
                Active Service Area
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-primary uppercase tracking-tighter leading-[0.9] break-words">
                MOVERS IN <span className="text-accent">{stateName}</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                We're proudly servicing {stateName} with our nationwide fleet of 51,000 professional movers.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 space-y-12">
              <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground">
                  <Search className="h-5 w-5" />
                </div>
                <input 
                  type="text"
                  placeholder="Search city or zip code..."
                  className="w-full h-16 pl-14 pr-6 rounded-full border border-gray-100 shadow-lg text-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-accent outline-none transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {cities.length > 0 ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <Globe className="h-6 w-6 text-accent" />
                    <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Cities Served</h2>
                  </div>
                  
                  {filteredCities.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredCities.map((city) => (
                        <Link 
                          key={city}
                          href={`/locations/${stateSlug}/${slugify(city)}`}
                          className="p-4 rounded-xl border border-gray-50 bg-gray-50/50 text-primary font-bold hover:bg-white hover:border-accent hover:text-accent hover:shadow-md transition-all group overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{city}</span>
                            <MapPin className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No cities found matching "{search}".
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-8 h-14 text-white font-bold uppercase tracking-wider">
                    <Link href="/quote">Request Quote</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 h-14 font-bold uppercase tracking-wider">
                    <Link href="/book">Book Now</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="p-8 bg-primary text-white rounded-3xl shadow-xl">
              <h3 className="text-lg font-bold mb-2 uppercase tracking-wide">Why {stateName}?</h3>
              <p className="opacity-80 text-sm leading-relaxed">
                Our local crews in {stateName} are trained to handle everything from high-rise apartment moves to complex commercial relocations. With 24/7 logistics support and real-time GPS tracking, your {stateName} move is in the safest hands in the industry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
