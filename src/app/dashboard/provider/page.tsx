"use client";

import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, MapPin, DollarSign, ExternalLink, Loader2, TrendingUp, Pencil } from "lucide-react";
import { geohashForLocation } from "geofire-common";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AVAILABLE_SERVICES } from "@/lib/services";

function ProviderDashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const providerRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "providers", user.uid);
  }, [firestore, user]);

  const { data: providerInfo, isLoading, error } = useDoc(providerRef);
  
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [geohash, setGeohash] = useState<string | null>(null);

  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [completedJobsCount, setCompletedJobsCount] = useState<number>(0);

  // Calculate Earnings
  useEffect(() => {
    if (!user || !firestore) return;
    const fetchEarnings = async () => {
      try {
        const q = query(
          collection(firestore, "jobs"),
          where("providerIds", "array-contains", user.uid),
          where("status", "==", "completed")
        );
        const snapshot = await getDocs(q);
        let total = 0;
        let count = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.price) {
            total += (data.price * 0.85); // 85% payout
          }
          count++;
        });
        setTotalEarnings(total);
        setCompletedJobsCount(count);
      } catch (err) {
        console.error("Error fetching earnings", err);
      }
    };
    fetchEarnings();
  }, [user, firestore]);

  useEffect(() => {
    if (providerInfo) {
      setBusinessName(providerInfo.businessName || "");
      setBio(providerInfo.bio || "");
      if (Array.isArray(providerInfo.services)) {
        setServices(providerInfo.services);
      }
      if (providerInfo.location) {
        setLocation(providerInfo.location);
        setGeohash(providerInfo.geohash || null);
      }
    }
  }, [providerInfo]);

  // Check Stripe Status on load if account ID exists
  useEffect(() => {
    const checkStripeStatus = async () => {
      if (!providerInfo?.stripeAccountId || providerInfo.stripeOnboardingComplete) return;
      
      try {
        const res = await fetch("/api/stripe/account-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: providerInfo.stripeAccountId })
        });
        const data = await res.json();
        
        if (data.chargesEnabled && data.payoutsEnabled) {
          await updateDoc(providerRef!, { stripeOnboardingComplete: true });
          toast({ title: "Bank Account Connected!", description: "You are ready to receive payouts." });
        }
      } catch (err) {
        console.error("Failed to fetch stripe status", err);
      }
    };
    checkStripeStatus();
  }, [providerInfo?.stripeAccountId, providerInfo?.stripeOnboardingComplete, providerRef, toast]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerRef) return;
    setSaving(true);
    try {
      await updateDoc(providerRef, {
        businessName,
        bio,
        services
      });
      toast({ title: "Profile Updated Successfully", description: "Your details have been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const setDemoCOI = async () => {
    if (!providerRef) return;
    try {
      await updateDoc(providerRef, {
        "onboarding.insuranceUploaded": true
      });
      toast({ title: "Insurance Uploaded", description: "Demo COI marked as true." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSetLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
      return;
    }
    
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const hash = geohashForLocation([lat, lng]);
        
        setLocation({ lat, lng });
        setGeohash(hash);
        
        if (providerRef) {
          try {
            await updateDoc(providerRef, {
              location: { lat, lng },
              geohash: hash
            });
            toast({ title: "Location Saved", description: "Your service location has been updated." });
          } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
          }
        }
        setSaving(false);
      },
      (err) => {
        toast({ variant: "destructive", title: "Location Error", description: err.message });
        setSaving(false);
      }
    );
  };

  const handleConnectBank = async () => {
    if (!user || !providerRef || !providerInfo) return;
    setStripeStatusLoading(true);
    
    try {
      if (providerInfo.stripeAccountId) {
        // Resume onboarding
        const res = await fetch("/api/stripe/account-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: providerInfo.stripeAccountId })
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } else {
        // Create new account
        const res = await fetch("/api/stripe/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email: user.email, 
            businessName: providerInfo.businessName || "Independent Provider" 
          })
        });
        const data = await res.json();
        if (data.accountId && data.url) {
          await updateDoc(providerRef, { stripeAccountId: data.accountId });
          window.location.href = data.url;
        } else {
          throw new Error(data.error || "Failed to create account");
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Connection Failed", description: err.message });
      setStripeStatusLoading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading dashboard...</div>;
  if (!providerInfo && !isLoading) {
    return <div className="p-8 text-center text-red-500">Provider record not found. Please contact support.</div>;
  }

  const isPending = providerInfo?.status === "pending";

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <header>
        <h1 className="text-3xl font-black text-slate-900 uppercase">Provider <span className="text-accent">Dashboard</span></h1>
        <p className="text-muted-foreground">Manage your marketplace profile and onboarding</p>
      </header>

      {isPending && (
        <div className="bg-amber-100/50 border border-amber-300 rounded-xl p-6 flex items-start gap-4 text-amber-900">
          <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-lg mb-1">Your Account is Pending Review</h3>
            <p className="text-sm">
              Please complete your profile below and ensure you have uploaded your insurance COI. 
              Our admin team will review your application shortly. You will not appear in the marketplace until approved.
            </p>
          </div>
        </div>
      )}

      {providerInfo?.status === "approved" && (
        <div className="bg-green-100/50 border border-green-300 rounded-xl p-6 flex items-start gap-4 text-green-900">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-lg mb-1">You are Live in the Marketplace!</h3>
            <p className="text-sm">
              Your profile is visible to customers in your area. Keep your profile updated to win more jobs.
            </p>
          </div>
        </div>
      )}

      {/* Earnings Overview */}
      {(providerInfo?.status === "approved" || completedJobsCount > 0) && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-none shadow-lg bg-slate-900 text-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Lifetime Earnings</p>
                  <p className="text-5xl font-black text-accent">${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-accent" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-4">85% Platform Payout Rate</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Completed Jobs</p>
                  <p className="text-5xl font-black text-slate-900">{completedJobsCount}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-4">Successfully fulfilled bookings</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-lg border-none">
        <CardHeader className="bg-slate-50 border-b border-gray-100 rounded-t-xl">
          <CardTitle className="text-xl font-black uppercase text-slate-800">Public Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name / Display Name</Label>
              <Input 
                id="businessName" 
                value={businessName} 
                onChange={(e) => setBusinessName(e.target.value)} 
                className="h-12 border-gray-200"
                placeholder="Bay Area Quick Movers"
                required
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Services Offered</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs font-bold text-accent hover:text-accent hover:bg-accent/10"
                  onClick={() => setIsEditingServices(!isEditingServices)}
                >
                  {isEditingServices ? "Done" : <><Pencil className="w-3 h-3 mr-1" /> Edit</>}
                </Button>
              </div>
              
              {!isEditingServices ? (
                <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-12 items-center">
                  {services.length > 0 ? (
                    services.map(s => <Badge key={s} variant="secondary" className="bg-white shadow-sm border-gray-200 text-slate-700">{s}</Badge>)
                  ) : (
                    <span className="text-sm text-muted-foreground italic">No services selected yet.</span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                  {AVAILABLE_SERVICES.map((item) => (
                    <div key={item.id} className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 bg-white hover:bg-slate-50 transition-colors">
                      <Checkbox
                        id={`service-${item.id}`}
                        checked={services.includes(item.label)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setServices([...services, item.label]);
                          } else {
                            setServices(services.filter((s) => s !== item.label));
                          }
                        }}
                      />
                      <label htmlFor={`service-${item.id}`} className="font-medium text-sm leading-none cursor-pointer flex-1">
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About Your Business</Label>
              <Textarea 
                id="bio" 
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                className="min-h-[120px] border-gray-200"
                placeholder="Tell customers about your experience and expertise..."
              />
            </div>

            <div className="pt-4 border-t flex justify-end">
              <Button type="submit" disabled={saving} className="bg-accent hover:bg-accent/90 text-white font-bold h-12 px-8 uppercase tracking-wider rounded-xl">
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-none mt-8">
         <CardHeader className="bg-slate-50 border-b border-gray-100 rounded-t-xl flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black uppercase text-slate-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            Service Location
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-bold text-slate-900">Your Base Location</p>
              <p className="text-sm text-muted-foreground mt-1">
                {location ? (
                  <>
                    <span className="text-green-600 font-bold">Location Set</span> 
                    <span className="ml-2 hidden sm:inline">(Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)})</span>
                  </>
                ) : (
                  <span className="text-amber-600 font-bold">Not Set</span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">We use this to connect you with customers in your radius.</p>
            </div>
            
            <Button 
              onClick={handleSetLocation} 
              disabled={saving}
              variant={location ? "outline" : "default"} 
              className={location ? "border-accent text-accent hover:bg-accent hover:text-white" : "bg-accent hover:bg-accent/90 text-white"}
            >
              {saving ? "Locating..." : (location ? "Update Location" : "Share My Location")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-none mt-8">
         <CardHeader className="bg-slate-50 border-b border-gray-100 rounded-t-xl">
          <CardTitle className="text-xl font-black uppercase text-slate-800">Insurance & Compliance</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-bold text-slate-900">Certificate of Liability Insurance (COI)</p>
              <p className="text-sm text-muted-foreground mt-1">
                Status: {providerInfo?.onboarding?.insuranceUploaded ? 
                  <span className="text-green-600 font-bold">Uploaded & Verified</span> : 
                  <span className="text-amber-600 font-bold">Pending Upload</span>}
              </p>
            </div>
            {!providerInfo?.onboarding?.insuranceUploaded && (
              <Button onClick={setDemoCOI} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white font-bold rounded-lg transition-all shrink-0">
                Simulate Upload
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connect Section */}
      <Card className="shadow-lg border-none mt-8 overflow-hidden">
        <div className="bg-slate-900 border-b border-gray-100 p-6">
          <CardTitle className="text-xl font-black uppercase text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            Payments & Payouts
          </CardTitle>
          <p className="text-slate-400 text-sm mt-1">Connect your bank account securely via Stripe to receive payouts directly to your bank.</p>
        </div>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-bold text-slate-900">Bank Account Setup</p>
              <p className="text-sm text-muted-foreground mt-1">
                {providerInfo?.stripeOnboardingComplete ? (
                  <span className="text-green-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Account Connected & Verified
                  </span>
                ) : providerInfo?.stripeAccountId ? (
                  <span className="text-amber-600 font-bold">Onboarding Incomplete</span>
                ) : (
                  <span className="text-slate-500 font-medium">Not Connected</span>
                )}
              </p>
            </div>
            
            <Button 
              onClick={handleConnectBank} 
              disabled={stripeStatusLoading}
              className={providerInfo?.stripeOnboardingComplete 
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold" 
                : "bg-[#635BFF] hover:bg-[#4f46e5] text-white font-bold"}
            >
              {stripeStatusLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {providerInfo?.stripeOnboardingComplete ? "Update Bank Details" : (providerInfo?.stripeAccountId ? "Complete Onboarding" : "Connect with Stripe")}
              {!stripeStatusLoading && <ExternalLink className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}

export default function ProviderDashboardPage() {
  return (
    <ProviderLayout>
      <ProviderDashboardContent />
    </ProviderLayout>
  );
}
