"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Star, ShieldCheck, LocateFixed, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Provider = {
  id: string; businessName: string; bio: string; services: string[]; rating: number; reviewCount: number;
  hourlyRate: number | null; verified: boolean; featured: boolean; topRated: boolean; jobsCompleted: number; distance: number | null;
};
const SEARCH_KEY = "wsm-marketplace-search";

/**
 * Provider marketplace (#141): ask where the move is (ZIP code, or the
 * browser's location as an option) and list approved providers near it.
 */
export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [miles, setMiles] = useState(50);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lastQuery = useRef<Record<string, string> | null>(null);
  const search = useCallback(async (params: Record<string, string>) => {
    lastQuery.current = params;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/public/providers-near?${new URLSearchParams({ ...params, miles: String(miles) })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setProviders(data.providers); setPlace(data.place || "your location");
    } catch (e) {
      setProviders(null); setError(e instanceof Error ? e.message : "Search failed.");
    } finally { setLoading(false); }
  }, [miles]);

  // Changing the radius re-runs the last search.
  useEffect(() => { if (lastQuery.current) void search(lastQuery.current); }, [search]);

  // Returning visitors see providers near their last ZIP right away.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_KEY);
      if (saved && saved.trim().length >= 3) { setQuery(saved); void search({ q: saved }); }
    } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) { setError("Enter your address, city, or ZIP code."); return; }
    try { localStorage.setItem(SEARCH_KEY, q); } catch { /* storage blocked */ }
    void search({ q });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Your browser can’t share its location. Enter a ZIP code instead."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => void search({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
      () => { setLoading(false); setError("We couldn’t get your location. Enter a ZIP code instead."); },
      { timeout: 10000 },
    );
  };

  return (
    <PublicLayout>
      <div className="bg-slate-50 min-h-screen pt-32 pb-24">
        <div className="container max-w-6xl mx-auto px-4">
          <header className="mb-10 text-center max-w-2xl mx-auto animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight">
              Provider <span className="text-accent">Marketplace</span>
            </h1>
            <p className="mt-4 text-slate-600 text-lg">Enter the address you&apos;re moving from and we&apos;ll show independent moving pros near you, backed by the Wont Stop Moving guarantee.</p>
          </header>

          <form onSubmit={searchAddress} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-10 grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
            <div className="space-y-2">
              <Label htmlFor="market-address" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Your address</Label>
              <Input id="market-address" autoComplete="street-address" maxLength={200} placeholder="e.g. 123 Main St, San Francisco, CA (or just a ZIP)" value={query} onChange={e => setQuery(e.target.value)} className="h-12 border-slate-300 text-lg" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market-miles" className="text-sm font-bold text-slate-700 uppercase tracking-wider">Within</Label>
              <select id="market-miles" value={miles} onChange={e => setMiles(Number(e.target.value))} className="h-12 rounded-md border border-slate-300 bg-white px-3">
                {[10, 25, 50, 100].map(m => <option key={m} value={m}>{m} miles</option>)}
              </select>
            </div>
            <Button type="submit" disabled={loading} className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold px-8">
              <Search className="w-4 h-4 mr-2" /> {loading ? "Searching…" : "Show providers"}
            </Button>
            <button type="button" onClick={useMyLocation} className="md:col-span-3 justify-self-start text-sm font-semibold text-primary underline inline-flex items-center gap-1">
              <LocateFixed className="w-4 h-4" /> Or use my current location
            </button>
            {error && <p role="alert" className="md:col-span-3 text-sm text-red-700">{error}</p>}
          </form>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-2xl" />)}
            </div>
          ) : providers === null ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
              <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">Enter your address to see providers near you.</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
              <h3 className="text-xl font-bold text-slate-900">No providers within {miles} miles of {place} yet</h3>
              <p className="text-slate-500">Try a wider radius, or book our own crew directly.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {miles < 100 && <Button variant="outline" onClick={() => setMiles(100)}>Search 100 miles</Button>}
                <Button asChild><Link href="/book">Book Wont Stop Moving</Link></Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">{providers.length} provider{providers.length === 1 ? "" : "s"} near {place}</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map(provider => (
                  <Card key={provider.id} className={`border-none shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden ${provider.featured ? "ring-2 ring-accent" : ""}`}>
                    <div className="h-24 bg-slate-900 relative">
                      {provider.featured && <div className="absolute top-4 left-4 bg-accent text-white text-xs font-bold px-2 py-1 rounded flex items-center"><Sparkles className="w-3 h-3 mr-1" />Featured</div>}
                      {provider.verified && <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center"><ShieldCheck className="w-3 h-3 mr-1" />Verified</div>}
                    </div>
                    <CardContent className="p-6 relative">
                      <div className="w-16 h-16 bg-white rounded-xl shadow-md border-4 border-white absolute -top-8 flex items-center justify-center text-2xl font-black text-accent">
                        {provider.businessName.charAt(0).toUpperCase()}
                      </div>
                      <div className="mt-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{provider.businessName}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm font-medium">
                          <span className="flex items-center text-amber-500"><Star className="w-4 h-4 fill-current" /><span className="ml-1 text-slate-700">{provider.reviewCount ? `${provider.rating.toFixed(1)} (${provider.reviewCount})` : "New"}</span></span>
                          {provider.topRated && <span className="text-amber-700 font-bold border-l border-slate-300 pl-2">Top rated</span>}
                          {provider.jobsCompleted > 0 && <span className="text-slate-500 border-l border-slate-300 pl-2">{provider.jobsCompleted} jobs</span>}
                          {provider.distance !== null && <span className="flex items-center text-slate-500 border-l border-slate-300 pl-2"><MapPin className="w-3.5 h-3.5 mr-1" />{provider.distance.toFixed(1)} mi</span>}
                          {provider.hourlyRate && <span className="text-slate-500 border-l border-slate-300 pl-2">${provider.hourlyRate}/hr</span>}
                        </div>
                        <p className="text-slate-600 text-sm line-clamp-3 mb-4">{provider.bio || "Independent moving professional."}</p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {provider.services.slice(0, 3).map(s => <Badge key={s} variant="secondary" className="bg-slate-100 text-slate-700 capitalize">{s}</Badge>)}
                          {provider.services.length > 3 && <Badge variant="secondary" className="bg-slate-100 text-slate-700">+{provider.services.length - 3} more</Badge>}
                        </div>
                        <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-11">
                          <Link href={`/marketplace/${provider.id}`}>View Profile</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
