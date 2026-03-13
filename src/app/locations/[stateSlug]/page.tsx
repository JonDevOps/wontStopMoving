
"use client";

import { PublicLayout } from '@/components/layout/public-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, ArrowLeft, Globe } from 'lucide-react';
import Link from 'next/link';
import { useState, use } from 'react';

const ALABAMA_CITIES = [
  "Abbeville", "Adamsville", "Alabaster", "Albertville", "Alexander City", "Alexandria", "Alpine", "Altoona", "Andalusia", "Anniston", "Arab", "Ardmore", "Ariton", "Arley", "Ashford", "Ashland", "Athens", "Atmore", "Attalla", "Auburn", "Bay Minette", "Beatrice", "Berry", "Bessemer", "Birmingham", "Blountsville", "Boaz", "Brantley", "Bremen", "Brent", "Brewton", "Bridgeport", "Brookwood", "Brownsboro", "Brundidge", "Calera", "Carrollton", "Cedar Bluff", "Centre", "Chelsea", "Cherokee", "Chickasaw", "Childersburg", "Citronelle", "Clanton", "Clayton", "Cleveland", "Coffeeville", "Cottondale", "Cottonwood", "Cowarts", "Cropwell", "Crossville", "Cuba", "Cullman", "Cusseta", "Dadeville", "Daleville", "Daphne", "Dawson", "Decatur", "Demopolis", "Dothan", "Douglas", "Eastaboga", "Eclectic", "Eight Mile", "Elba", "Elberta", "Elmore", "Enterprise", "Eufaula", "Eutaw", "Eva", "Evergreen", "Fairhope", "Falkville", "Fayette", "Flomaton", "Florala", "Florence", "Foley", "Forestdale", "Fort Deposit", "Fort Mitchell", "Fort Payne", "Fultondale", "Fyffe", "Gadsden", "Gardendale", "Geneva", "Georgiana", "Gordo", "Grand Bay", "Grant", "Graysville", "Greensboro", "Greenville", "Grove Hill", "Gulf Shores", "Guntersville", "Haleyville", "Hamilton", "Hanceville", "Harpersville", "Hartford", "Hartselle", "Harvest", "Hatchechubbee", "Hazel Green", "Headland", "Heflin", "Helena", "Henagar", "Highland Home", "Holly Pond", "Hollywood", "Hoover", "Hueytown", "Huntsville", "Irondale", "Irvington", "Jacksons Gap", "Jacksonville", "Jasper", "Jemison", "Killen", "Laceys Spring", "Lafayette", "Lanett", "Leeds", "Leesburg", "Leroy", "Lexington", "Lillian", "Lineville", "Livingston", "Louisville", "Loxley", "Madison", "Marion", "Maylene", "Mc Calla", "Mc Kenzie", "Meridianville", "Midfield", "Midland City", "Millbrook", "Mobile", "Monroeville", "Montevallo", "Montgomery", "Moody", "Moulton", "Mount Olive", "Mount Vernon", "Munford", "Muscle Shoals", "Nauvoo", "New Hope", "New Market", "Newton", "Newville", "Northport", "Oak Grove", "Odenville", "Oneonta", "Opelika", "Opp", "Orange Beach", "Owens Cross Roads", "Owens Crossroads", "Oxford", "Ozark", "Pansey", "Pelham", "Pell City", "Peterman", "Phenix", "Phenix City", "Phil Campbell", "Piedmont", "Pinson", "Prattville", "Rainbow City", "Remlap", "Roanoke", "Robertsdale", "Rogersville", "Russellville", "Rutledge", "Salem", "Samson", "Sand Rock", "Saraland", "Satsuma", "Scottsboro", "Selma", "Semmes", "Sheffield", "Shelby", "Slocomb", "Smiths Station", "Snead", "Somerville", "Southside", "Spanish Fort", "Springville", "Steele", "Sterrett", "Sumiton", "Sweet Water", "Sylacauga", "Sylvan Springs", "Talladega", "Tallassee", "Tanner", "Theodore", "Toney", "Town Creek", "Trafford", "Trinity", "Troy", "Trussville", "Tuscaloosa", "Tuscumbia", "Tuskegee", "Union Springs", "Valley", "Vernon", "Vestavia Hills", "Vinemont", "Wadley", "Warrior", "Weaver", "Wedowee", "West Blocton", "Wetumpka", "Wilmer", "Winfield", "Woodstock", "York"
].sort();

export default function StatePage({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = use(params);
  const [search, setSearch] = useState('');

  const formatTitle = (slug: string) => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const slugify = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  };

  const stateName = formatTitle(stateSlug);
  const isAlabama = stateSlug.toLowerCase() === 'alabama';

  const filteredCities = isAlabama 
    ? ALABAMA_CITIES.filter(city => city.toLowerCase().includes(search.toLowerCase()))
    : [];

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
              <h1 className="text-5xl md:text-7xl font-black text-primary uppercase tracking-tighter">
                MOVERS IN <span className="text-accent">{stateName}</span>
              </h1>
              <p className="text-xl text-muted-foreground">
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

              {isAlabama && (
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
                          className="p-4 rounded-xl border border-gray-50 bg-gray-50/50 text-primary font-bold hover:bg-white hover:border-accent hover:text-accent hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span>{city}</span>
                            <MapPin className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
              )}
              
              {!isAlabama && !search && (
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
