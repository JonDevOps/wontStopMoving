"use client";

import { useState, useMemo } from 'react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Globe, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';

interface SearchResult {
  type: 'state' | 'city';
  name: string;
  stateName?: string;
  href: string;
}

export default function LocationsPage() {
  const [search, setSearch] = useState('');

  // Enhanced search that returns specific state and city objects
  const searchResults = useMemo(() => {
    const query = search.toLowerCase().trim();
    
    // Default view: Show all states alphabetically
    if (!query) {
      return ALL_LOCATIONS.map(loc => ({
        type: 'state',
        name: loc,
        href: `/locations/${slugify(loc)}`
      })) as SearchResult[];
    }

    const results: SearchResult[] = [];

    // 1. Check for matching states
    ALL_LOCATIONS.forEach(state => {
      if (state.toLowerCase().includes(query)) {
        results.push({
          type: 'state',
          name: state,
          href: `/locations/${slugify(state)}`
        });
      }
    });

    // 2. Check for matching cities across all states
    Object.entries(CITIES_BY_STATE).forEach(([stateKey, cities]) => {
      const stateName = ALL_LOCATIONS.find(loc => slugify(loc) === stateKey) || stateKey;
      
      cities.forEach(city => {
        if (city.toLowerCase().includes(query)) {
          results.push({
            type: 'city',
            name: city,
            stateName: String(stateName),
            href: `/locations/${stateKey}/${slugify(city)}`
          });
        }
      });
    });

    // Sort: States first, then cities, both alphabetically
    return results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'state' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [search]);

  // Limit results for better performance and UX on long lists
  const visibleResults = search ? searchResults.slice(0, 50) : searchResults;

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-6">
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-primary uppercase tracking-tighter leading-[0.9]">
                SERVICE <span className="text-accent">LOCATIONS</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Find professional movers in your area. Search by city, state, or zip code to see our local coverage.
              </p>
            </div>

            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <Input 
                type="text"
                placeholder="Search city or state..."
                className="h-16 pl-14 pr-6 rounded-full border-none shadow-2xl text-lg bg-white focus:ring-2 focus:ring-accent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Globe className="h-6 w-6 text-accent" />
                  <h2 className="text-2xl font-black text-primary uppercase tracking-tight">
                    {search ? 'Search Results' : 'Active Regions'}
                  </h2>
                </div>
                {search && searchResults.length > 50 && (
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Showing top 50 matches
                  </span>
                )}
              </div>

              {visibleResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                  {visibleResults.map((result, idx) => (
                    <Link 
                      key={`${result.type}-${result.name}-${idx}`}
                      href={result.href}
                      className="flex flex-col py-3 px-4 rounded-xl hover:bg-gray-50 border border-transparent hover:border-accent/20 transition-all group"
                    >
                      <div className="flex items-center gap-2 text-primary font-bold group-hover:text-accent transition-colors">
                        <MapPin className={`h-4 w-4 shrink-0 ${result.type === 'state' ? 'text-accent' : 'text-accent/40'}`} />
                        <span className="truncate">{result.name}</span>
                        {result.type === 'city' && (
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all" />
                        )}
                      </div>
                      {result.type === 'city' && (
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-6">
                          {result.stateName}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground text-lg">No locations found matching "{search}"</p>
                  <button 
                    onClick={() => setSearch('')}
                    className="text-accent font-black uppercase tracking-widest text-xs hover:underline"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
