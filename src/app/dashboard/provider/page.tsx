"use client";

import { Progress } from "@/components/ui/progress";
import { ProviderLayout } from "@/components/layout/provider-layout";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import {
  useAuth,
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useStorage,
} from "@/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  MapPin,
  DollarSign,
  ExternalLink,
  Loader2,
  TrendingUp,
  Pencil,
  CreditCard,
  Shield,
  FileText,
  Camera,
  ListChecks,
} from "lucide-react";
import { geohashForLocation } from "geofire-common";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AVAILABLE_SERVICES } from "@/lib/services";
import { TwoFactorCard } from "@/components/security/two-factor-card";

function ProviderDashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const providerRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "providers", user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userProfileRef);
  const { data: providerInfo, isLoading } = useDoc(providerRef);

  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [idType, setIdType] = useState<string>("drivers_license");
  const storage = useStorage();

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const insuranceInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [completedJobsCount, setCompletedJobsCount] = useState<number>(0);

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
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.price) {
            total += data.price * 0.85;
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
      }
      if (providerInfo.onboarding?.idType) {
        setIdType(providerInfo.onboarding.idType);
      }
      setTermsAccepted(providerInfo.termsAccepted || false);
    }
  }, [providerInfo]);

  useEffect(() => {
    const checkStripeStatus = async () => {
      if (
        !providerInfo?.stripeAccountId ||
        providerInfo.stripeOnboardingComplete
      )
        return;

      try {
        // The server checks Stripe and records the result on your provider profile.
        const data = await apiFetch<{ chargesEnabled: boolean; payoutsEnabled: boolean }>(
          auth,
          "/api/stripe/account-status",
          {}
        );

        if (data.chargesEnabled && data.payoutsEnabled) {
          toast({
            title: "Bank Account Connected!",
            description: "You are ready to receive 85% automated payouts.",
          });
        }
      } catch (err) {
        console.error("Failed to fetch stripe status", err);
      }
    };
    checkStripeStatus();
  }, [
    providerInfo?.stripeAccountId,
    providerInfo?.stripeOnboardingComplete,
    auth,
    toast,
  ]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerRef || !user) return;
    setSaving(true);
    try {
      await setDoc(
        providerRef,
        {
          uid: user.uid,
          email: user.email,
          businessName,
          bio,
          services,
          termsAccepted,
          status: providerInfo?.status || "pending",
        },
        { merge: true }
      );
      toast({
        title: "Profile Updated Successfully",
        description: "Your business details have been saved.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (field: string, file: File) => {
    if (!providerRef || !file || !user) return;

    setIsUploading(field);
    try {
      const { uploadVerificationDocument } = await import("@/lib/storage-upload");
      const downloadURL = await uploadVerificationDocument(user.uid, field, file);
      const storagePath = `verifications/${user.uid}/${field}_${Date.now()}_${file.name}`;

      const isInsurance = field === "insurance";
      const firestoreField = isInsurance
        ? "onboarding.insuranceUploaded"
        : `onboarding.${field}Uploaded`;
      const urlField = isInsurance
        ? "onboarding.insuranceUrl"
        : `onboarding.${field}Url`;

      await setDoc(
        providerRef,
        {
          onboarding: {
            ...(providerInfo?.onboarding || {}),
            idType,
            [isInsurance ? "insuranceUploaded" : `${field}Uploaded`]: true,
            [isInsurance ? "insuranceUrl" : `${field}Url`]: downloadURL,
            [`${field}Path`]: storagePath,
            [`${field}UpdatedAt`]: new Date().toISOString(),
          },
        },
        { merge: true }
      );

      // Also update via dot notation if doc exists
      try {
        await updateDoc(providerRef, {
          "onboarding.idType": idType,
          [firestoreField]: true,
          [urlField]: downloadURL,
        });
      } catch {
        // merged above
      }

      toast({
        title: "Upload Successful",
        description: `${file.name} has been saved to your secure profile.`,
      });
    } catch (err: any) {
      console.error("Dashboard Upload Error:", err);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: err.message,
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleSetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: "Geolocation is not supported by your browser.",
      });
      return;
    }

    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const hash = geohashForLocation([lat, lng]);

        setLocation({ lat, lng });

        if (providerRef) {
          try {
            await setDoc(
              providerRef,
              {
                location: { lat, lng },
                geohash: hash,
              },
              { merge: true }
            );
            toast({
              title: "Location Saved",
              description: "Your service radius location has been updated.",
            });
          } catch (err: any) {
            toast({
              variant: "destructive",
              title: "Error",
              description: err.message,
            });
          }
        }
        setSaving(false);
      },
      (err) => {
        toast({
          variant: "destructive",
          title: "Location Error",
          description: err.message,
        });
        setSaving(false);
      }
    );
  };

  const handleConnectBank = async () => {
    if (!user || !providerRef) return;
    setStripeStatusLoading(true);

    try {
      // The server creates (or reuses) your own Stripe account and returns its onboarding link.
      const data = await apiFetch<{ url: string }>(auth, "/api/stripe/account", {});
      window.location.href = data.url;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Stripe Connect Notice",
        description: err.message,
      });
      setStripeStatusLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center animate-pulse font-black text-primary uppercase tracking-widest text-xs">
        Loading Provider Command Center...
      </div>
    );
  }

  const requiresBack = idType !== "passport";
  const idVerified = Boolean(
    providerInfo?.onboarding?.selfieUploaded &&
      providerInfo?.onboarding?.idFrontUploaded &&
      (!requiresBack || providerInfo?.onboarding?.idBackUploaded)
  );
  const twoFactorDone = Boolean(userProfile?.twoFactorEnabled);

  const actionTasks = [
    {
      label: "1. Complete Business Bio & Services Offered",
      done: Boolean(bio && services.length > 0 && termsAccepted),
      anchor: "#profile-section",
    },
    {
      label: "2. Set Operational Base GPS Location",
      done: Boolean(location),
      anchor: "#location-section",
    },
    {
      label:
        "3. Submit ID Verification (Driver's License, Passport, State or Military ID)",
      done: idVerified,
      anchor: "#id-section",
    },
    {
      label: "4. Enable Two-Factor Authentication (2FA)",
      done: twoFactorDone,
      anchor: "#two-factor-section",
    },
    {
      label: "5. Upload Certificate of Liability Insurance (COI)",
      done: Boolean(providerInfo?.onboarding?.insuranceUploaded),
      anchor: "#insurance-section",
    },
    {
      label: "6. Connect Business Bank Account via Stripe (85% Payouts)",
      done: Boolean(providerInfo?.stripeOnboardingComplete),
      anchor: "#stripe-section",
    },
  ];

  const completionPercentage = Math.round(
    (actionTasks.filter((s) => s.done).length / actionTasks.length) * 100
  );

  const idUploadItems = [
    {
      field: "selfie",
      uploadedKey: "selfieUploaded",
      label: "1. Selfie Holding ID",
      icon: Camera,
      desc: "Face & ID clearly visible",
      ref: selfieInputRef,
    },
    {
      field: "idFront",
      uploadedKey: "idFrontUploaded",
      label:
        idType === "passport"
          ? "2. Passport Photo Page"
          : "2. Government ID - Front",
      icon: CreditCard,
      desc: "Full legal name & photo",
      ref: frontInputRef,
    },
    ...(requiresBack
      ? [
          {
            field: "idBack",
            uploadedKey: "idBackUploaded",
            label: "3. Government ID - Back",
            icon: FileText,
            desc: "Barcode & address details",
            ref: backInputRef,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl pb-20">
      {/* Top Hero & Completion Bar */}
      <header className="relative overflow-hidden p-8 rounded-3xl bg-slate-900 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <Badge className="mb-3 bg-accent hover:bg-accent text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {providerInfo?.status || "Pending Review"} • 85% Payout Tier
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-2">
              Provider <span className="text-accent">Command Center</span>
            </h1>
            <p className="text-slate-400 font-medium max-w-lg text-sm">
              Complete your onboarding tasks at your own pace, manage marketplace jobs, and track your 85% Stripe payouts.
            </p>
          </div>

          <div className="space-y-3 min-w-[260px] bg-white/5 p-5 rounded-2xl border border-white/10">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Setup Progress
              </span>
              <span className="text-2xl font-black text-accent">
                {completionPercentage}%
              </span>
            </div>
            <Progress value={completionPercentage} className="h-2 bg-slate-800" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {actionTasks.filter((t) => t.done).length} of {actionTasks.length}{" "}
              tasks completed
            </p>
          </div>
        </div>
      </header>

      {/* Insights & Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-slate-900 text-white rounded-3xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Net Earnings (85% Share)
              </p>
              <p className="text-3xl font-black text-accent mt-1">
                $
                {totalEarnings.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Direct via Stripe Connect
              </p>
            </div>
            <div className="p-3.5 bg-white/10 rounded-2xl">
              <TrendingUp className="w-7 h-7 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-3xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Completed Moves
              </p>
              <p className="text-3xl font-black text-primary mt-1">
                {completedJobsCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Fulfilled marketplace bookings
              </p>
            </div>
            <div className="p-3.5 bg-green-500/10 rounded-2xl">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-3xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Services Listed
              </p>
              <p className="text-3xl font-black text-primary mt-1">
                {services.length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Active marketplace specialties
              </p>
            </div>
            <div className="p-3.5 bg-accent/10 rounded-2xl">
              <FileText className="w-7 h-7 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Tasks Checklist Card */}
      <Card className="border-none shadow-md bg-white rounded-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
            <ListChecks className="h-5 w-5 text-accent" />
            Post-Signup Tasks & Activation Checklist
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            ID verification, 2FA, insurance, and Stripe payout connection can all be completed right on this page at your convenience.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionTasks.map((task, idx) => (
              <a
                key={idx}
                href={task.anchor}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  task.done
                    ? "bg-green-50/60 border-green-200"
                    : "bg-slate-50/70 border-slate-100 hover:border-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  {task.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-accent shrink-0" />
                  )}
                  <span
                    className={`text-xs font-black uppercase tracking-tight ${
                      task.done ? "text-green-900" : "text-primary"
                    }`}
                  >
                    {task.label}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    task.done
                      ? "bg-green-100 text-green-700 border-none text-[10px] font-black uppercase"
                      : "text-accent border-accent/30 text-[10px] font-black uppercase"
                  }
                >
                  {task.done ? "Done" : "To Do"}
                </Badge>
              </a>
            ))}
          </div>

          <div id="two-factor-section" className="pt-2">
            <TwoFactorCard userProfile={userProfile} compact />
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Public Profile Details */}
      <Card
        id="profile-section"
        className="shadow-lg border-none bg-white rounded-3xl overflow-hidden"
      >
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <div className="w-2 h-6 bg-accent rounded-full" />
            1. Public Business Profile & Services
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
                className="h-12 border-gray-200 rounded-xl"
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
                  {isEditingServices ? (
                    "Done"
                  ) : (
                    <>
                      <Pencil className="w-3 h-3 mr-1" /> Select Services
                    </>
                  )}
                </Button>
              </div>

              {!isEditingServices ? (
                <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-12 items-center">
                  {services.length > 0 ? (
                    services.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="bg-white shadow-sm border-gray-200 text-slate-700"
                      >
                        {s}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      No services selected yet — click &quot;Select Services&quot; to choose.
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_SERVICES.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-row items-center space-x-3 rounded-xl border p-3.5 bg-white hover:bg-slate-50"
                    >
                      <Checkbox
                        id={`service-${item.id}`}
                        checked={services.includes(item.label)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setServices([...services, item.label]);
                          } else {
                            setServices(
                              services.filter((s) => s !== item.label)
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={`service-${item.id}`}
                        className="font-medium text-sm leading-none cursor-pointer flex-1"
                      >
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
                className="min-h-[110px] border-gray-200 rounded-xl"
                placeholder="Tell customers about your moving crew, fleet, and experience..."
              />
            </div>

            <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                />
                <Label htmlFor="terms" className="text-xs font-medium cursor-pointer">
                  I agree to the{" "}
                  <Link href="/terms" className="text-accent hover:underline">
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-accent hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
              <Button
                type="submit"
                disabled={saving || !termsAccepted}
                className="bg-accent hover:bg-accent/90 text-white font-bold h-12 px-8 uppercase tracking-wider rounded-xl shadow-lg shadow-accent/20"
              >
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Section 2: Service Location */}
      <Card
        id="location-section"
        className="shadow-lg border-none bg-white rounded-3xl overflow-hidden"
      >
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-accent" />
            2. Service Dispatch Location
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <p className="font-black text-slate-900 uppercase tracking-tight">
                Your Base Coordinates
              </p>
              <div className="flex items-center gap-2">
                {location ? (
                  <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-black uppercase">
                    Active ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-200 text-[10px] font-black uppercase"
                  >
                    Not Set Yet
                  </Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSetLocation}
              disabled={saving}
              className="h-12 px-8 rounded-xl bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest text-xs"
            >
              {saving
                ? "Locating..."
                : location
                ? "Update GPS Location"
                : "Set My Location"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Identity & KYC Verification (Fixed Upload Refs + ID Type Selector) */}
      <Card
        id="id-section"
        className="shadow-lg border-none bg-white rounded-3xl overflow-hidden"
      >
        <CardHeader className="bg-slate-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            3. Identity Verification (Post-Signup Task)
          </CardTitle>
          <div className="w-full sm:w-72">
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-white">
                <SelectValue placeholder="Choose ID Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drivers_license" className="text-xs font-bold">
                  Driver&apos;s License (Front & Back)
                </SelectItem>
                <SelectItem value="state_id" className="text-xs font-bold">
                  State ID Card (Front & Back)
                </SelectItem>
                <SelectItem value="passport" className="text-xs font-bold">
                  Passport (Photo Page Only)
                </SelectItem>
                <SelectItem value="military_cdl" className="text-xs font-bold">
                  Military ID / CDL (Front & Back)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Accepted formats: JPG, PNG, WEBP, HEIC photos, or PDF documents.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {idUploadItems.map((docItem) => {
              const isUploaded = Boolean(
                providerInfo?.onboarding?.[docItem.uploadedKey]
              );
              return (
                <div
                  key={docItem.field}
                  className="p-6 bg-slate-50/70 rounded-2xl border border-slate-100 flex flex-col items-center text-center gap-4"
                >
                  <div
                    className={`p-4 rounded-2xl ${
                      isUploaded
                        ? "bg-green-100 text-green-600"
                        : "bg-white text-slate-400"
                    }`}
                  >
                    <docItem.icon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {docItem.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{docItem.desc}</p>
                    <div className="pt-1">
                      {isUploaded ? (
                        <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-black uppercase">
                          Uploaded
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-700 border-amber-200 text-[10px] font-black uppercase"
                        >
                          Pending Task
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-full">
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
                      ref={docItem.ref}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(docItem.field, file);
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => docItem.ref.current?.click()}
                      variant={isUploaded ? "outline" : "default"}
                      size="sm"
                      disabled={isUploading === docItem.field}
                      className={`w-full h-10 text-[10px] font-black uppercase tracking-widest rounded-xl ${
                        isUploaded
                          ? ""
                          : "bg-accent hover:bg-accent/90 text-white"
                      }`}
                    >
                      {isUploading === docItem.field ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isUploaded ? "Replace File" : "Upload File"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Insurance COI */}
      <Card
        id="insurance-section"
        className="shadow-lg border-none bg-white rounded-3xl overflow-hidden"
      >
        <CardHeader className="bg-slate-50/50 border-b border-gray-100">
          <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            4. Insurance & Compliance (COI)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <p className="font-black text-slate-900 uppercase tracking-tight">
                Certificate of Liability Insurance (PDF or Image)
              </p>
              <div className="flex items-center gap-2">
                {providerInfo?.onboarding?.insuranceUploaded ? (
                  <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-black uppercase">
                    Uploaded
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-200 text-[10px] font-black uppercase"
                  >
                    Pending Task
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <input
                type="file"
                hidden
                accept="application/pdf,image/*,.pdf"
                ref={insuranceInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload("insurance", file);
                }}
              />
              <Button
                type="button"
                onClick={() => insuranceInputRef.current?.click()}
                disabled={isUploading === "insurance"}
                variant={
                  providerInfo?.onboarding?.insuranceUploaded
                    ? "outline"
                    : "default"
                }
                className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                {isUploading === "insurance" && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {providerInfo?.onboarding?.insuranceUploaded
                  ? "Update COI"
                  : "Upload COI"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Stripe Connect Bank Payouts */}
      <Card
        id="stripe-section"
        className="shadow-xl border-none bg-slate-900 text-white rounded-3xl overflow-hidden"
      >
        <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#635BFF]" />
              <h3 className="text-xl font-black uppercase tracking-tight">
                5. Business Bank & Stripe Payouts
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
              Connect your business bank account via Stripe Connect Express to receive automated 85% payouts upon job completion.
            </p>
            <div>
              {providerInfo?.stripeOnboardingComplete ? (
                <Badge className="bg-green-500 text-white border-none text-[10px] font-black uppercase">
                  Bank Connected & Verified
                </Badge>
              ) : (
                <Badge className="bg-slate-800 text-slate-300 border-none text-[10px] font-black uppercase">
                  {providerInfo?.stripeAccountId
                    ? "Onboarding Started"
                    : "Not Connected Yet"}
                </Badge>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleConnectBank}
            disabled={stripeStatusLoading}
            className="h-12 px-8 rounded-xl bg-[#635BFF] hover:bg-[#4f46e5] text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-[#635BFF]/20 shrink-0"
          >
            {stripeStatusLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {providerInfo?.stripeOnboardingComplete
              ? "Update Bank Details"
              : providerInfo?.stripeAccountId
              ? "Resume Stripe Onboarding"
              : "Connect Business Bank"}
            {!stripeStatusLoading && <ExternalLink className="w-4 h-4 ml-2" />}
          </Button>
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
