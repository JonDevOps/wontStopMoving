"use client";

import { useState } from 'react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Globe } from 'lucide-react';
import Link from 'next/link';

const ALL_LOCATIONS = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "District Of Columbia", "Delaware", "Florida", "Georgia", "Hawaii", "Iowa", "Idaho", "Illinois", "Indiana", "Kansas", "Kentucky", "Louisiana", "Massachusetts", "Maryland", "Maine", "Michigan", "Minnesota", "Missouri", "Mississippi", "Montana", "North Carolina", "North Dakota", "Nebraska", "New Hampshire", "New Jersey", "New Mexico", "Nevada", "New York", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Puerto Rico", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Virginia", "Vermont", "Washington", "Wisconsin", "West Virginia", "Wyoming",
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland", "Nova Scotia", "Northwest Territory", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
].sort();

export default function LocationsPage() {
  const [search, setSearch] = useState('');

  const filteredLocations = ALL_LOCATIONS.filter(loc => 
    loc.toLowerCase().includes(search.toLowerCase())
  );

  const slugify = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-6">
              <h1 className="text-5xl md:text-7xl font-black text-primary uppercase tracking-tighter">
                SERVICE <span className="text-accent">LOCATIONS</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                We're expanding rapidly. Search by city, state, zip, or landmark to find professional movers in your area.
              </p>
            </div>

            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <Input 
                type="text"
                placeholder="Search city, state, zip, or landmark..."
                className="h-16 pl-14 pr-6 rounded-full border-none shadow-2xl text-lg bg-white focus:ring-2 focus:ring-accent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
                <Globe className="h-6 w-6 text-accent" />
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Active Regions</h2>
              </div>

              {filteredLocations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                  {filteredLocations.map((location) => (
                    <Link 
                      key={location}
                      href={`/locations/${slugify(location)}`}
                      className="flex items-center gap-2 py-2 text-primary font-bold hover:text-accent transition-colors group"
                    >
                      <MapPin className="h-4 w-4 text-accent/40 group-hover:text-accent transition-colors" />
                      {location}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No locations found matching "{search}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
