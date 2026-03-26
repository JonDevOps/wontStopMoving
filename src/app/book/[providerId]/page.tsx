"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ShieldCheck, MapPin, Calendar, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface ProviderProfile {
  id: string;
  businessName: string;
  hourlyRate?: number;
  minimumHours?: number;
}

export default function DirectBookingPage() {
  const params = useParams();
  const providerId = params.providerId as string;
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [hours, setHours] = useState<number>(2);
  const [moveDate, setMoveDate] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");

  useEffect(() => {
    const fetchProvider = async () => {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, "providers", providerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ProviderProfile;
          setProvider({ ...data, id: docSnap.id });
          setHours(data.minimumHours || 2);
        }
      } catch (err) {
        console.error("Error fetching provider", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProvider();
  }, [firestore, providerId]);

  if (loading || isUserLoading) {
    return (
      <PublicLayout>
        <div className="bg-slate-50 min-h-screen py-32 flex justify-center">
          <div className="animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
            Initializing Secure Checkout...
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!provider) {
    return (
      <PublicLayout>
        <div className="bg-slate-50 min-h-screen py-32 flex flex-col justify-center items-center">
          <h1 className="text-3xl font-black text-slate-800 uppercase mb-4">Provider Not Found</h1>
          <Button asChild><Link href="/marketplace">Return to Marketplace</Link></Button>
        </div>
      </PublicLayout>
    );
  }

  const hourlyRate = provider.hourlyRate || 50;
  const totalCost = hours * hourlyRate;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in or sign up to book a provider.",
      });
      router.push(`/login?redirect=/book/${providerId}`);
      return;
    }
    
    if (!pickupAddress || !dropoffAddress || !moveDate) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    if (!firestore) return;

    setIsSubmitting(true);
    try {
      const releaseCode = Math.floor(100000 + Math.random() * 900000).toString();

      const jobData = {
        customerId: user.uid,
        providerIds: [providerId],
        status: 'pending_payment',
        moveDate,
        pickupAddress,
        dropoffAddress,
        hoursReserved: hours,
        price: totalCost,
        releaseCode,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(firestore, "jobs"), jobData);
      
      // Call Stripe Checkout API
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: docRef.id,
          price: totalCost,
          businessName: provider.businessName,
          providerId: provider.id
        })
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        throw new Error("Failed to create Stripe checkout session");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast({
        variant: "destructive",
        title: "Booking Failed",
        description: "An error occurred while securing your booking.",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50 pt-32 pb-24">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-primary uppercase tracking-tighter">
              Secure Your <span className="text-accent">Booking</span>
            </h1>
            <p className="text-muted-foreground mt-4 font-medium">
              You are booking <strong className="text-slate-900">{provider.businessName}</strong> for your upcoming move.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            
            {/* Booking Form */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-xl">
                <CardHeader className="bg-slate-900 text-white rounded-t-xl px-8 py-6">
                  <CardTitle className="flex items-center gap-2 text-xl font-black tracking-widest uppercase">
                    <MapPin className="w-5 h-5 text-accent" /> Logistics Details
                  </CardTitle>
                  <CardDescription className="text-slate-400">Where are we moving you to?</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <form id="booking-form" onSubmit={handleBooking} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Move Date</Label>
                        <Input 
                          type="date" 
                          required 
                          className="h-14 font-medium text-slate-900"
                          value={moveDate}
                          onChange={(e) => setMoveDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Hours Needed</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            type="number" 
                            min={provider.minimumHours || 2} 
                            required 
                            className="h-14 pl-10 font-bold text-slate-900"
                            value={hours}
                            onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{provider.minimumHours || 2} Hour Minimum</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Pickup Address</Label>
                      <Input 
                        placeholder="123 Start St, City, ST" 
                        required 
                        className="h-14 font-medium"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Drop-off Address</Label>
                      <Input 
                        placeholder="456 End Ave, City, ST" 
                        required 
                        className="h-14 font-medium"
                        value={dropoffAddress}
                        onChange={(e) => setDropoffAddress(e.target.value)}
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Checkout Card */}
            <div className="lg:col-span-1 sticky top-24">
              <Card className="border-4 border-slate-900 shadow-2xl overflow-hidden">
                <div className="bg-slate-900 text-white p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">Upfront Quote</p>
                  <p className="text-5xl font-black">${totalCost}<span className="text-lg text-slate-400">.00</span></p>
                </div>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3 pb-6 border-b border-slate-100 text-sm font-medium text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Provider Base Rate</span>
                      <span className="text-slate-900 font-bold">${hourlyRate}/hr</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Reserved Time</span>
                      <span className="text-slate-900 font-bold">{hours} Hours</span>
                    </div>
                  </div>

                  {!user && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs font-bold">
                      You must be logged in to complete this booking. You'll be asked to log in or sign up.
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    form="booking-form"
                    disabled={isSubmitting}
                    className="w-full h-14 bg-accent hover:bg-accent/90 text-white text-lg font-black uppercase tracking-widest shadow-xl shadow-accent/20"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><ShieldCheck className="w-5 h-5 mr-2" /> Confirm Booking</>
                    )}
                  </Button>
                  <p className="text-center text-[10px] text-slate-400 font-bold uppercase">
                    No payment charged until job completion.
                  </p>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
