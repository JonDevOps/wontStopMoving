
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
import { ArrowLeft, MapPin, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ALL_LOCATIONS } from "@/lib/location-data";

const detailsSchema = z.object({
  address: z.string()
    .min(5, "Physical address is required")
    .refine(val => !val.toLowerCase().includes("po box"), "Physical address only (no PO Boxes)"),
  aptSuite: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Invalid zip code"),
  businessName: z.string().min(3, "Business name must be at least 3 characters"),
  businessDescription: z.string().min(10, "Please provide a brief description"),
  hasDotVehicle: z.enum(["yes", "no"]),
  affiliation: z.enum(["Independent", "U-Haul Dealer", "U-Haul Employee"]),
  source: z.string().min(1, "Please select how you heard about us"),
  agreeBackground: z.boolean().refine(val => val === true, "Must agree to background check"),
  agreeIndependent: z.boolean().refine(val => val === true, "Must acknowledge independent status"),
});

type DetailsValues = z.infer<typeof detailsSchema>;

export default function EmployeeDetailsPage() {
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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      hasDotVehicle: "no",
      affiliation: "Independent",
      agreeBackground: false,
      agreeIndependent: false,
    }
  });

  const onSubmit = async (data: DetailsValues) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const employeeRef = doc(firestore, "employees", user.uid);
      await updateDoc(employeeRef, {
        ...data,
        hasDotVehicle: data.hasDotVehicle === "yes",
        onboardingStep: 3,
      });

      // Update basic user profile state if needed
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, {
        state: data.state,
      });

      toast({
        title: "Details Saved",
        description: "Moving to Phase 3: Verification.",
      });
      
      router.push('/careers/apply/verification');

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
    return <div className="min-h-screen flex items-center justify-center">Verifying session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">Phase 2</span>
              <h1 className="text-3xl sm:text-4xl font-black text-primary uppercase">Your <span className="text-accent">Details</span></h1>
            </div>
            <p className="text-muted-foreground font-medium">Tell us more about your business and equipment.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <Card className="border-none shadow-xl overflow-hidden bg-white">
              <div className="h-1.5 bg-gray-100">
                <div className="h-full bg-accent w-2/3 transition-all duration-500" />
              </div>
              <CardContent className="p-8 sm:p-12 space-y-8">
                {/* Physical Location */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <MapPin className="h-5 w-5 text-accent" />
                    <h3 className="font-black text-primary uppercase tracking-tight">Physical Location</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Address (No PO Box)</Label>
                    <Input {...register("address")} placeholder="123 Main St" className="h-12 border-gray-200" />
                    {errors.address && <p className="text-xs text-destructive font-bold">{errors.address.message}</p>}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Apt or Suite</Label>
                      <Input {...register("aptSuite")} placeholder="Optional" className="h-12 border-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">City</Label>
                      <Input {...register("city")} placeholder="Dallas" className="h-12 border-gray-200" />
                      {errors.city && <p className="text-xs text-destructive font-bold">{errors.city.message}</p>}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">State</Label>
                      <Select onValueChange={(val) => setValue("state", val)}>
                        <SelectTrigger className="h-12 border-gray-200">
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
                      <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Zip Code</Label>
                      <Input {...register("zipCode")} placeholder="75201" className="h-12 border-gray-200" />
                      {errors.zipCode && <p className="text-xs text-destructive font-bold">{errors.zipCode.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Business Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Building2 className="h-5 w-5 text-accent" />
                    <h3 className="font-black text-primary uppercase tracking-tight">Business Profile</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Business Name</Label>
                    <Input {...register("businessName")} placeholder="Moving Masters LLC" className="h-12 border-gray-200" />
                    {errors.businessName && <p className="text-xs text-destructive font-bold">{errors.businessName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Business Description</Label>
                    <Textarea {...register("businessDescription")} placeholder="Briefly describe your services and experience..." className="min-h-[100px] border-gray-200" />
                    {errors.businessDescription && <p className="text-xs text-destructive font-bold">{errors.businessDescription.message}</p>}
                  </div>

                  <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Do you own a DOT registered vehicle?</Label>
                    <RadioGroup 
                      onValueChange={(val) => setValue("hasDotVehicle", val as "yes" | "no")} 
                      defaultValue="no"
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="dot-yes" />
                        <Label htmlFor="dot-yes" className="font-bold">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="dot-no" />
                        <Label htmlFor="dot-no" className="font-bold">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Professional Affiliation</Label>
                    <Select onValueChange={(val) => setValue("affiliation", val as any)} defaultValue="Independent">
                      <SelectTrigger className="h-12 border-gray-200">
                        <SelectValue placeholder="Select Affiliation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Independent">Independent Provider</SelectItem>
                        <SelectItem value="U-Haul Dealer">U-Haul Dealer</SelectItem>
                        <SelectItem value="U-Haul Employee">U-Haul Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">How did you hear about us?</Label>
                    <Select onValueChange={(val) => setValue("source", val)}>
                      <SelectTrigger className="h-12 border-gray-200">
                        <SelectValue placeholder="Select Source" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "U-Haul employee, Center, or Dealer",
                          "MovingHelp.com Customer",
                          "Existing Moving Helper",
                          "Web Search (Google, Bing, Yahoo, etc)",
                          "Craigslist",
                          "Social Media",
                          "Social media/Facebook",
                          "Indeed",
                          "Email",
                          "Billboard Ad",
                          "Google Search Ad",
                          "Gig Nation",
                          "YouTube ad",
                          "Other"
                        ].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.source && <p className="text-xs text-destructive font-bold">{errors.source.message}</p>}
                  </div>
                </div>

                {/* Confirmations */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 pb-2">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                    <h3 className="font-black text-primary uppercase tracking-tight">Acknowledgements</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="agreeBackground" onCheckedChange={(val) => setValue("agreeBackground", val === true)} />
                      <Label htmlFor="agreeBackground" className="text-sm font-medium leading-relaxed">
                        I am willing to be subject to a background check as part of my application.
                      </Label>
                    </div>
                    {errors.agreeBackground && <p className="text-xs text-destructive font-bold ml-8">{errors.agreeBackground.message}</p>}

                    <div className="flex items-start space-x-3">
                      <Checkbox id="agreeIndependent" onCheckedChange={(val) => setValue("agreeIndependent", val === true)} />
                      <Label htmlFor="agreeIndependent" className="text-sm font-medium leading-relaxed">
                        I understand that I am an independent provider or moving labor service and I am not an employee/representative of Wont Stop Moving® or its affiliates.
                      </Label>
                    </div>
                    {errors.agreeIndependent && <p className="text-xs text-destructive font-bold ml-8">{errors.agreeIndependent.message}</p>}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/90 min-h-14 text-lg font-black rounded-xl uppercase tracking-widest shadow-xl shadow-accent/20 mt-8"
                >
                  {isLoading ? "Saving Details..." : "Save & Continue to Phase 3"}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
