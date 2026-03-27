"use client";

import { Progress } from "@/components/ui/progress";
import { ProviderLayout } from "@/components/layout/provider-layout";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, MapPin, DollarSign, ExternalLink, Loader2, TrendingUp, Pencil, User, CreditCard, Shield, FileText, Camera } from "lucide-react";
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
  const [termsAccepted, setTermsAccepted] = useState(false);

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
      setTermsAccepted(providerInfo.termsAccepted || false);
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
        services,
        termsAccepted
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

  const simulateIdUpload = async (field: string) => {
    if (!providerRef) return;
    try {
      await updateDoc(providerRef, {
        [`onboarding.${field}`]: true
      });
      toast({ title: "Document Uploaded", description: `${field.replace(/([A-Z])/g, ' $1')} marked as completed.` });
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

  const completionStats = [
    { label: "Business Bio", done: !!bio },
    { label: "Services Selected", done: services.length > 0 },
    { label: "Location Set", done: !!location },
    { label: "Selfie Uploaded", done: !!providerInfo?.onboarding?.selfieUploaded },
    { label: "ID Front", done: !!providerInfo?.onboarding?.idFrontUploaded },
    { label: "ID Back", done: !!providerInfo?.onboarding?.idBackUploaded },
    { label: "Insurance", done: !!providerInfo?.onboarding?.insuranceUploaded },
    { label: "Bank Account", done: !!providerInfo?.stripeOnboardingComplete },
    { label: "Terms Accepted", done: termsAccepted }
  ];
  
  const completionPercentage = Math.round((completionStats.filter(s => s.done).length / completionStats.length) * 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl pb-20">
      <header className="relative overflow-hidden p-8 rounded-3xl bg-slate-900 text-white shadow-2xl mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
        <div className="relative z-10">
          <Badge className="mb-4 bg-accent hover:bg-accent text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-tighter">
            {providerInfo?.status || "Member"}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black uppercase leading-tight mb-2">
            Provider <span className="text-accent underline decoration-4 underline-offset-8">Dashboard</span>
          </h1>
          <p className="text-slate-400 font-medium max-w-lg mb-8">Manage your professional presence, identity verification, and earnings in one place.</p>
          
          <div className="space-y-3 max-w-md">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Profile Completion</span>
              <span className="text-2xl font-black text-accent">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2 bg-slate-800" />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Complete all steps to {providerInfo?.status === 'approved' ? 'maintain' : 'activate'} your account.
            </p>
          </div>
        </div>
      </header>

      {isPending && (
        <div className="bg-amber-100/50 border border-amber-300 rounded-xl p-6 flex items-start gap-4 text-amber-900">
          <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-lg mb-1">Your Account is Pending Review</h3>
            <p className="text-sm">
              Please complete your profile below, ensure you have uploaded your identity documents (Selfie & ID), covered your insurance COI, and accepted the terms.
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
          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden group">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-accent/20 transition-colors duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Lifetime Earnings</p>
                  <p className="text-5xl font-black text-accent tracking-tighter">${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500">
                  <TrendingUp className="w-8 h-8 text-accent" />
                </div>
              </div>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black mt-6">85% Platform Payout Rate</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-xl border border-white/20 overflow-hidden group">
            <CardContent className="p-8 relative">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Completed Jobs</p>
                  <p className="text-5xl font-black text-slate-900 tracking-tighter">{completedJobsCount}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl group-hover:rotate-12 transition-transform duration-500">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-6">Successfully fulfilled bookings</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-2xl border-none bg-white/90 backdrop-blur-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-gray-100 font-black">
          <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
             <div className="w-2 h-8 bg-accent rounded-full" />
             Public Profile Details
          </CardTitle>
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

            <div className="pt-6 border-t flex flex-col gap-4">
              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted} 
                  onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                />
                <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
                  I agree to the <Link href="/terms" className="text-accent hover:underline">Terms and Conditions</Link> and <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !termsAccepted} className="bg-accent hover:bg-accent/90 text-white font-bold h-12 px-8 uppercase tracking-wider rounded-xl shadow-lg shadow-accent/20">
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-2xl border-none bg-white/90 backdrop-blur-xl mt-8 overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b border-gray-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg"><MapPin className="h-5 w-5 text-accent" /></div>
            Service Location
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-accent/20 transition-all duration-500">
            <div className="space-y-1">
              <p className="font-black text-slate-900 uppercase tracking-tight">Your Base Location</p>
              <div className="flex items-center gap-2">
                {location ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] font-black uppercase">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 text-[10px] font-black uppercase">Not Set</Badge>
                )}
                <span className="text-xs text-slate-400 font-medium">
                  {location ? `(${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` : 'Requires GPS access'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Connected to local customer radius</p>
            </div>
            
            <Button 
              onClick={handleSetLocation} 
              disabled={saving}
              variant={location ? "outline" : "default"} 
              className={`h-12 px-8 rounded-xl font-black uppercase tracking-widest transition-all duration-300 ${location ? "border-accent text-accent hover:bg-accent hover:text-white" : "bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20"}`}
            >
              {saving ? "Locating..." : (location ? "Update Location" : "Share My Location")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-2xl border-none bg-white/90 backdrop-blur-xl mt-8 overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b border-gray-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg"><Shield className="h-5 w-5 text-accent" /></div>
            Identity & KYC Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { id: 'selfieUploaded', label: 'Selfie with ID', icon: Camera, desc: 'Face clearly visible' },
              { id: 'idFrontUploaded', label: 'ID Front', icon: CreditCard, desc: 'Full legal name and photo' },
              { id: 'idBackUploaded', label: 'ID Back', icon: FileText, desc: 'Barcode and address' }
            ].map((doc) => (
              <div key={doc.id} className="group p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-accent/20 transition-all duration-500 flex flex-col items-center text-center gap-4">
                <div className={`p-5 rounded-2xl transition-all duration-500 ${providerInfo?.onboarding?.[doc.id] ? 'bg-green-50 text-green-500 scale-110' : 'bg-slate-50 text-slate-300 group-hover:bg-accent/5 group-hover:text-accent'}`}>
                  <doc.icon className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-900">{doc.label}</p>
                  <p className="text-[10px] font-medium text-slate-400 italic">{doc.desc}</p>
                  <div className="pt-2">
                    {providerInfo?.onboarding?.[doc.id] ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[9px] font-black uppercase px-2 py-0.5">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-300 border-slate-200 text-[9px] font-black uppercase px-2 py-0.5">Pending</Badge>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={() => simulateIdUpload(doc.id)} 
                  variant="ghost" 
                  size="sm"
                  className="w-full h-10 text-[10px] font-black uppercase tracking-[0.2em] text-accent hover:bg-accent hover:text-white rounded-xl border border-accent/10 transition-all"
                >
                  {providerInfo?.onboarding?.[doc.id] ? "Update Photo" : "Upload Now"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-2xl border-none bg-white/90 backdrop-blur-xl mt-8 overflow-hidden">
         <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
             <div className="p-2 bg-accent/10 rounded-lg"><FileText className="h-5 w-5 text-accent" /></div>
             Insurance & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 transition-all duration-500 hover:border-accent/20">
            <div className="space-y-1">
              <p className="font-black text-slate-900 uppercase tracking-tight">Certificate of Liability (COI)</p>
              <div className="flex items-center gap-2">
                {providerInfo?.onboarding?.insuranceUploaded ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] font-black uppercase">Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 text-[10px] font-black uppercase">Required</Badge>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Document must list 'Wont Stop Moving' as additional insured</p>
            </div>
            {!providerInfo?.onboarding?.insuranceUploaded ? (
              <Button onClick={setDemoCOI} variant="outline" className="h-12 px-8 rounded-xl border-accent text-accent hover:bg-accent hover:text-white font-black uppercase tracking-widest transition-all duration-300">
                Upload
              </Button>
            ) : (
              <Button onClick={setDemoCOI} variant="ghost" className="h-12 px-8 rounded-xl border-accent/20 text-slate-400 hover:bg-accent hover:text-white font-black uppercase tracking-widest transition-all duration-300">
                Update COI
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connect Section */}
      <Card className="shadow-2xl border-none bg-slate-900 text-white mt-8 overflow-hidden group">
        <div className="bg-white/5 border-b border-white/5 p-8 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#635BFF]/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <CardTitle className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-3 relative z-10">
            <div className="p-2 bg-[#635BFF]/20 rounded-lg"><DollarSign className="h-5 w-5 text-[#635BFF]" /></div>
            Payments & Payouts
          </CardTitle>
          <p className="text-slate-500 text-xs font-medium mt-2 max-w-md relative z-10 uppercase tracking-widest leading-loose">Connect your bank account securely via Stripe to receive automated payouts directly to your bank.</p>
        </div>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 transition-all duration-500 hover:border-[#635BFF]/30 group">
            <div className="space-y-1">
              <p className="font-black text-white uppercase tracking-tight">Bank Account Status</p>
              <div className="flex items-center gap-2">
                {providerInfo?.stripeOnboardingComplete ? (
                  <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase">Verified & Active</Badge>
                ) : providerInfo?.stripeAccountId ? (
                  <Badge className="bg-amber-500 text-white border-none text-[10px] font-black uppercase">Action Required</Badge>
                ) : (
                  <Badge className="bg-slate-700 text-slate-400 border-none text-[10px] font-black uppercase">Not Connected</Badge>
                )}
              </div>
            </div>
            
            <Button 
              onClick={handleConnectBank} 
              disabled={stripeStatusLoading}
              className={`h-12 px-8 rounded-xl font-black uppercase tracking-widest transition-all duration-300 ${providerInfo?.stripeOnboardingComplete 
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                : "bg-[#635BFF] hover:bg-[#4f46e5] text-white shadow-lg shadow-[#635BFF]/20"}`}
            >
              {stripeStatusLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {providerInfo?.stripeOnboardingComplete ? "Update Payout Details" : (providerInfo?.stripeAccountId ? "Resume Onboarding" : "Connect Stripe")}
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
