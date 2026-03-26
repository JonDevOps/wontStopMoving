"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, orderBy, startAt, endAt } from "firebase/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Star, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface Provider {
  id: string;
  businessName: string;
  bio: string;
  services: string[];
  location?: { lat: number; lng: number };
  geohash?: string;
  distance?: number;
  onboarding?: { insuranceUploaded: boolean };
  status: string;
}

export default function MarketplacePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRadius, setSearchRadius] = useState(50); // miles
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    // Load all approved providers initially
    const loadAllProviders = async () => {
      if (!firestore) return;
      try {
        const q = query(collection(firestore, "providers"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider));
        setProviders(data);
      } catch (err: any) {
        console.error("Error loading providers:", err);
      } finally {
        setLoading(false);
      }
    };
    if (!userLocation) {
      loadAllProviders();
    }
  }, [firestore, userLocation]);

  const handleSearchByLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        
        if (!firestore) return;
        try {
          // Radius search using geofire-common
          const radiusInM = searchRadius * 1609.34; // miles to meters
          const bounds = geohashQueryBounds([lat, lng], radiusInM);
          const promises = [];
          
          for (const b of bounds) {
            const q = query(
              collection(firestore, "providers"),
              orderBy("geohash"),
              startAt(b[0]),
              endAt(b[1])
            );
            promises.push(getDocs(q));
          }
          
          const snapshots = await Promise.all(promises);
          const matchingDocs: Provider[] = [];
          
          snapshots.forEach((snap) => {
            snap.docs.forEach((docSnap) => {
              const data = docSnap.data() as Provider;
              if (data.status !== "approved") return; // Only show approved
              
              if (data.location) {
                // We have to filter out false positives because the geohash query is a bounding box
                const distanceInKm = distanceBetween([lat, lng], [data.location.lat, data.location.lng]);
                const distanceInM = distanceInKm * 1000;
                if (distanceInM <= radiusInM) {
                  matchingDocs.push({
                    ...data,
                    id: docSnap.id,
                    distance: distanceInKm * 0.621371 // Convert km to miles
                  });
                }
              }
            });
          });
          
          // Sort by distance
          matchingDocs.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          
          // Deduplicate (since the same doc can appear in multiple bounding boxes on edge cases)
          const uniqueProviders = Array.from(new Map(matchingDocs.map(item => [item.id, item])).values());
          
          setProviders(uniqueProviders);
        } catch (err: any) {
          console.error("Geosearch error:", err);
          toast({ variant: "destructive", title: "Search Error", description: "Could not complete location search." });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        toast({ variant: "destructive", title: "Location Error", description: err.message });
        setLoading(false);
      }
    );
  };

  return (
    <PublicLayout>
      <div className="bg-slate-50 min-h-screen py-12">
        <div className="container max-w-6xl mx-auto px-4">
          <header className="mb-12 text-center max-w-2xl mx-auto animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight">
              Provider <span className="text-accent text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-500">Marketplace</span>
            </h1>
            <p className="mt-4 text-slate-600 text-lg">
              Find and hire independent moving professionals in your area. Backed by the Wont Stop Moving platform guarantee.
            </p>
          </header>

          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-10 flex flex-col md:flex-row gap-4 items-end animate-fade-in-up animation-delay-100">
            <div className="flex-1 w-full space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Search Radius (Miles)</label>
              <Input 
                type="number" 
                value={searchRadius} 
                onChange={(e) => setSearchRadius(Number(e.target.value))} 
                className="h-12 border-slate-300"
              />
            </div>
            <Button 
              onClick={handleSearchByLocation} 
              className="h-12 w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-8"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Find Providers Near Me
            </Button>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Providers Found</h3>
              <p className="text-slate-500">
                {userLocation 
                  ? `We couldn't find any approved providers within ${searchRadius} miles of your location.` 
                  : "There are currently no approved providers in the marketplace."}
              </p>
              {userLocation && (
                <Button variant="outline" className="mt-6" onClick={() => { setUserLocation(null); }}>
                  Show All Providers
                </Button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((provider, index) => (
                <Card key={provider.id} className="border-none shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                  <div className="h-32 bg-slate-900 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                    {provider.onboarding?.insuranceUploaded && (
                      <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center shadow-lg">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Verified
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6 relative">
                    <div className="w-16 h-16 bg-white rounded-xl shadow-md border-4 border-white absolute -top-8 flex items-center justify-center text-2xl font-black text-accent">
                      {provider.businessName.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{provider.businessName}</h3>
                      
                      <div className="flex items-center gap-2 mb-4 text-sm font-medium">
                        <div className="flex items-center text-amber-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="ml-1 text-slate-700">New</span>
                        </div>
                        {provider.distance !== undefined && (
                          <div className="flex items-center text-slate-500 border-l border-slate-300 pl-2">
                            <MapPin className="w-3.5 h-3.5 mr-1" />
                            {provider.distance.toFixed(1)} miles away
                          </div>
                        )}
                      </div>

                      <p className="text-slate-600 text-sm line-clamp-3 mb-4">
                        {provider.bio || "Independent moving professional."}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-6">
                        {provider.services?.slice(0, 3).map(service => (
                          <Badge key={service} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                            {service}
                          </Badge>
                        ))}
                        {provider.services?.length > 3 && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">+{provider.services.length - 3} more</Badge>
                        )}
                      </div>
                      
                      <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-11">
                        <Link href={`/marketplace/${provider.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
