"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, MapPin, Building2, ShieldCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ALL_LOCATIONS } from "@/lib/location-data";
import { PublicLayout } from "@/components/layout/public-layout";

const detailsSchema = z.object({
  address: z.string()
    .min(5, "Physical address is required")
    .refine(val => !val.toLowerCase().includes("po box"), "Physical address only (no PO Boxes)"),
  aptSuite: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Invalid zip code"),
  businessName: z.string().min(3, "Business name must be at least 3 characters"),
  bio: z.string().min(10, "Please provide a brief description"),
  hasInsurance: z.enum(["yes", "no"]),
  agreeIndependent: z.boolean().refine(val => val === true, "Must acknowledge independent status"),
});

type DetailsValues = z.infer<typeof detailsSchema>;

export default function ProviderDetailsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
  }, [user, isUserLoading, router]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      hasInsurance: "no",
      agreeIndependent: false,
    }
  });

  const onSubmit = async (data: DetailsValues) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const providerRef = doc(firestore, "providers", user.uid);
      await updateDoc(providerRef, {
        address: data.address,
        aptSuite: data.aptSuite || "",
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        businessName: data.businessName,
        bio: data.bio,
        hasInsurance: data.hasInsurance === "yes",
        onboardingStep: 3,
      });

      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, {
        state: data.state,
      });

      toast({
        title: "Details Saved",
        description: "Moving to Phase 3: Verification.",
      });
      
      router.push('/provider-signup/verification');

    } catch (error: any) {
      console.error("Update Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save details. Please check your connection.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        <p className="mt-4 text-primary font-black uppercase tracking-widest text-xs">Authenticating Session...</p>
      </div>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto">
            
            {/* Stepper */}
            <div className="mb-16 relative">
              <div className="flex justify-between items-center relative z-10 px-4">
                {[
                  { label: "Account", done: true },
                  { label: "Your Details", active: true },
                  { label: "Verification", active: false },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${step.done ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-110' : step.active ? 'bg-white border-accent text-accent shadow-lg shadow-accent/10 scale-110' : 'bg-white border-gray-200 text-gray-400'}`}>
                      {step.done ? <CheckCircle2 className="h-6 w-6" /> : <span className="text-sm font-black">{i + 1}</span>}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${step.active || step.done ? 'text-primary' : 'text-gray-400'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="absolute top-6 left-0 w-full h-[2px] bg-gray-200 -z-0">
                <div className="h-full bg-primary transition-all duration-700" style={{ width: '50%' }} />
              </div>
            </div>

            <div className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-[0.2em]">Phase 2</span>
                <h1 className="text-4xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Your <span className="text-accent">Business Details</span></h1>
              </div>
              <p className="text-muted-foreground font-medium text-lg">Tell us more about your company and operations.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <Card className="border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl rounded-[2.5rem]">
                <CardContent className="p-8 sm:p-14 space-y-12">
                  
                  {/* Physical Location */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <div className="bg-accent/10 p-2 rounded-xl">
                        <MapPin className="h-6 w-6 text-accent" />
                      </div>
                      <h3 className="font-black text-primary uppercase tracking-tighter text-xl">Operational Base</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Physical Address (No PO Box)</Label>
                      <Input {...register("address")} placeholder="123 Growth Way" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                      {errors.address && <p className="text-xs text-destructive font-bold">{errors.address.message}</p>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Suite / Unit</Label>
                        <Input {...register("aptSuite")} placeholder="Ste 400" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">City</Label>
                        <Input {...register("city")} placeholder="Austin" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                        {errors.city && <p className="text-xs text-destructive font-bold">{errors.city.message}</p>}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">State</Label>
                        <Select onValueChange={(val) => setValue("state", val)}>
                          <SelectTrigger className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_LOCATIONS.map(loc => (
                              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.state && <p className="text-xs text-destructive font-bold">{errors.state.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Zip Code</Label>
                        <Input {...register("zipCode")} placeholder="78701" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                        {errors.zipCode && <p className="text-xs text-destructive font-bold">{errors.zipCode.message}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Business Profile */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-black text-primary uppercase tracking-tighter text-xl">Business Profile</h3>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Registered Business Name</Label>
                      <Input {...register("businessName")} placeholder="Moving Solutions Group Inc." className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                      {errors.businessName && <p className="text-xs text-destructive font-bold">{errors.businessName.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Experience & Capabilities</Label>
                      <Textarea {...register("bio")} placeholder="Detail your team's experience, specialization, and fleet capacity..." className="min-h-[140px] border-gray-100 bg-gray-50/50 rounded-2xl focus:ring-accent focus:border-accent font-medium p-6" />
                      {errors.bio && <p className="text-xs text-destructive font-bold">{errors.bio.message}</p>}
                    </div>

                    <div className="space-y-4 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <Label className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-600">Do you currently carry General Liability Insurance?</Label>
                      <RadioGroup 
                        onValueChange={(val) => setValue("hasInsurance", val as "yes" | "no")} 
                        defaultValue="no"
                        className="flex gap-10 mt-2"
                      >
                        <div className="flex items-center space-x-3 cursor-pointer">
                          <RadioGroupItem value="yes" id="ins-yes" className="w-5 h-5" />
                          <Label htmlFor="ins-yes" className="font-bold text-sm cursor-pointer">Yes, active policy</Label>
                        </div>
                        <div className="flex items-center space-x-3 cursor-pointer">
                          <RadioGroupItem value="no" id="ins-no" className="w-5 h-5" />
                          <Label htmlFor="ins-no" className="font-bold text-sm cursor-pointer">No, not currently</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* Acknowledgements */}
                  <div className="space-y-6 pt-8 border-t border-gray-50">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-5 w-5 text-accent" />
                      <h3 className="font-black text-primary uppercase tracking-widest text-xs">Security Protocols</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-start space-x-4 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <Checkbox id="agreeIndependent" onCheckedChange={(val) => setValue("agreeIndependent", val === true)} className="mt-1 w-5 h-5 rounded-md" />
                        <Label htmlFor="agreeIndependent" className="text-sm font-bold text-slate-600 leading-relaxed cursor-pointer">
                          I acknowledge that my business operates as an independent entity and is not an employee or direct representative of Wont Stop Moving® or its corporate affiliates.
                        </Label>
                      </div>
                      {errors.agreeIndependent && <p className="text-xs text-destructive font-bold ml-12">{errors.agreeIndependent.message}</p>}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-accent hover:bg-accent/90 min-h-[4rem] text-xl font-black rounded-[1.5rem] uppercase tracking-[0.2em] shadow-2xl shadow-accent/30 mt-4 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    {isLoading ? "Saving Data..." : "Continue to Verification"}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
