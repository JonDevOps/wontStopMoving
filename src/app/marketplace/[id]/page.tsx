"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { useFirestore } from "@/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Star, MapPin, CheckCircle2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface ProviderProfile {
  id: string;
  businessName: string;
  bio: string;
  services: string[];
  location?: { lat: number; lng: number };
  onboarding?: { insuranceUploaded: boolean };
  status: string;
  hourlyRate?: number;
  minimumHours?: number;
  reviews?: any[];
  averageRating?: number;
}

export default function ProviderProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProvider = async () => {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, "providers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ProviderProfile;
          if (data.status === "approved" || data.status === "pending") {
             // Fetch reviews
             const reviewsRef = collection(firestore, "providers", id, "reviews");
             const reviewsQuery = query(reviewsRef, orderBy("createdAt", "desc"));
             const reviewsSnap = await getDocs(reviewsQuery);
             
             let totalRating = 0;
             const reviewsData = reviewsSnap.docs.map(d => {
                const r = d.data();
                totalRating += r.rating || 0;
                return { id: d.id, ...r };
             });
             
             const averageRating = reviewsData.length > 0 ? Number((totalRating / reviewsData.length).toFixed(1)) : 0;
             setProvider({ ...data, id: docSnap.id, reviews: reviewsData, averageRating });
          }
        }
      } catch (err) {
        console.error("Error fetching provider", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProvider();
  }, [firestore, id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="bg-slate-50 min-h-screen py-12">
          <div className="container max-w-4xl mx-auto px-4 space-y-8 animate-pulse">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!provider) {
    return (
      <PublicLayout>
        <div className="bg-slate-50 min-h-screen py-24 flex flex-col justify-center items-center">
          <h1 className="text-3xl font-black text-slate-800 uppercase mb-4">Provider Not Found</h1>
          <p className="text-slate-500 mb-8">This provider may no longer be active or pending approval.</p>
          <Button asChild>
            <Link href="/marketplace">Return to Marketplace</Link>
          </Button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="bg-slate-50 min-h-screen pb-24">
        {/* Header Banner */}
        <div className="h-64 md:h-80 bg-slate-900 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          <div className="container max-w-5xl mx-auto px-4 h-full relative flex items-end pb-8">
            <Link href="/marketplace" className="absolute top-8 left-4 text-white hover:text-accent flex items-center font-bold text-sm transition-colors">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Marketplace
            </Link>
          </div>
        </div>

        <div className="container max-w-5xl mx-auto px-4 -mt-20 relative z-10">
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8 items-start">
            
            <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-100 rounded-2xl shadow-inner border-4 border-white shrink-0 flex items-center justify-center text-5xl font-black text-accent mt-[-4rem]">
              {provider.businessName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900">{provider.businessName}</h1>
                  <div className="flex items-center gap-4 mt-2 text-sm font-medium text-slate-600">
                    <span className="flex items-center text-amber-500 gap-1">
                      <Star className="w-4 h-4 fill-current" />
                      {provider.averageRating && provider.averageRating > 0 ? `${provider.averageRating} (${provider.reviews?.length} Reviews)` : "New Provider"}
                    </span>
                    {provider.location && (
                      <span className="flex items-center gap-1 border-l pl-4 border-slate-200">
                        <MapPin className="w-4 h-4" />
                        Operating Region Set
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px] text-right md:text-left">
                  {provider.hourlyRate ? (
                    <div className="mb-1 text-right">
                      <p className="text-3xl font-black text-slate-900">${provider.hourlyRate}<span className="text-sm text-slate-500 font-bold">/hr</span></p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{provider.minimumHours || 2} hr minimum</p>
                    </div>
                  ) : null}
                  <Button asChild className="w-full bg-accent hover:bg-accent/90 h-14 text-lg font-black uppercase tracking-widest shadow-lg shadow-accent/20">
                    <Link href={`/book/${provider.id}`}>
                      Book Now
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {provider.status === "approved" && (
                  <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 w-fit">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">Background Checked</span>
                  </div>
                )}
                {provider.onboarding?.insuranceUploaded && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200 w-fit">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">Verified Insured</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-8">
            <div className="md:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
                  About <span className="text-accent">{provider.businessName}</span>
                </h2>
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {provider.bio || "This provider hasn't added a bio yet, but they are ready to help you move!"}
                  </p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase text-slate-800 mb-6">Verified Reviews ({provider.reviews?.length || 0})</h2>
                {provider.reviews && provider.reviews.length > 0 ? (
                  <div className="space-y-6">
                    {provider.reviews.map((r) => (
                      <div key={r.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-current" : "text-slate-200 fill-slate-200"}`} />
                            ))}
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{r.customerName}</span>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-auto">
                            {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm italic">"{r.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-500 font-medium">This provider is new to Wont Stop Moving.</p>
                    <p className="text-sm text-slate-400 mt-1">Be the first to hire and review them!</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg border border-amber-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent rounded-full blur-[80px] opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
                <h2 className="text-xl font-black uppercase mb-4 text-accent">Services Offered</h2>
                <ul className="space-y-3">
                  {provider.services?.length > 0 ? provider.services.map((service, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
                      <span className="font-medium text-slate-200 capitalize">{service.replace(/_/g, " ")}</span>
                    </li>
                  )) : (
                    <li className="text-slate-400 text-sm italic">General Moving Services</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
