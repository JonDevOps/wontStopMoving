"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Truck, 
  MapPin, 
  Package, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles,
  ShieldCheck,
  Trash2,
  Wrench,
  Warehouse,
  Zap,
  GraduationCap,
  Shield,
  Lock,
  Loader2,
  Music
} from "lucide-react";
import { useFirestore, useUser, useAuth } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc, addDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

const formSchema = z.object({
  pickupZip: z.string().min(5, "Invalid Zip"),
  dropoffZip: z.string().min(5, "Invalid Zip"),
  moveDate: z.string().min(1, "Select a date"),
  moveSize: z.string().min(1, "Select move size"),
  specialItems: z.string().optional(),
  // Add-ons
  packingService: z.boolean().default(false),
  cratingService: z.boolean().default(false),
  cleaningService: z.boolean().default(false),
  junkRemoval: z.boolean().default(false),
  assemblyService: z.boolean().default(false),
  storageService: z.boolean().default(false),
  expressMoving: z.boolean().default(false),
  pianoMoving: z.boolean().default(false),
  // Discounts
  isStudent: z.boolean().default(false),
  isMilitary: z.boolean().default(false),
  // Contact
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Invalid phone"),
  password: z.string().min(8, "Password must be 8+ characters").optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function QuoteForm({ providerId }: { providerId?: string }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalSteps = 5;
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      moveSize: "1br",
      packingService: false,
      cratingService: false,
      cleaningService: false,
      junkRemoval: false,
      assemblyService: false,
      storageService: false,
      expressMoving: false,
      pianoMoving: false,
      isStudent: false,
      isMilitary: false,
    }
  });

  // Pre-fill fields if user is logged in
  useEffect(() => {
    if (user && !isUserLoading) {
      const fetchProfile = async () => {
        const docRef = doc(firestore, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setValue("name", data.name || "");
          setValue("email", data.email || "");
          setValue("phone", data.phone || "");
        }
      };
      fetchProfile();
    }
  }, [user, isUserLoading, setValue, firestore]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    let currentUserId = user?.uid;

    try {
      // 1. Handle Account Creation if not logged in
      if (!currentUserId) {
        if (!data.password) {
          toast({
            variant: "destructive",
            title: "Password Required",
            description: "Please provide a password to secure your account and track your quote.",
          });
          setIsSubmitting(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;
        currentUserId = newUser.uid;

        // Create the user profile in Firestore
        await setDoc(doc(firestore, "users", currentUserId), {
          id: currentUserId,
          email: data.email,
          name: data.name,
          phone: data.phone,
          role: 'customer',
          state: "New",
          createdAt: serverTimestamp(),
        });
      }

      // 2. Save the Quote
      const quotesRef = collection(firestore, 'quotes');
      await addDoc(quotesRef, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        pickupZip: data.pickupZip,
        dropoffZip: data.dropoffZip,
        moveDate: data.moveDate,
        moveSize: data.moveSize,
        specialItems: data.specialItems || "",
        customerId: currentUserId,
        preferredProviderId: providerId || null,
        status: 'new',
        createdAt: serverTimestamp(),
        details: JSON.stringify({
          pickupZip: data.pickupZip,
          dropoffZip: data.dropoffZip,
          moveDate: data.moveDate,
          moveSize: data.moveSize,
          specialItems: data.specialItems,
          isStudent: data.isStudent,
          isMilitary: data.isMilitary,
          addOns: {
            packing: data.packingService,
            crating: data.cratingService,
            cleaning: data.cleaningService,
            junkRemoval: data.junkRemoval,
            assembly: data.assemblyService,
            storage: data.storageService,
            express: data.expressMoving,
            piano: data.pianoMoving
          }
        })
      });

      setStep(6); // Success step
    } catch (error: any) {
      console.error("Submission Error:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "An error occurred while processing your request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const progress = (step / totalSteps) * 100;

  const addOns = [
    { id: "packingService", label: "White-Glove Packing", icon: Package, desc: "We wrap and box everything for you." },
    { id: "cratingService", label: "Specialty Crating", icon: ShieldCheck, desc: "Custom wood crates for high-value items." },
    { id: "cleaningService", label: "Move-In/Out Cleaning", icon: Sparkles, desc: "Deep cleaning for old or new home." },
    { id: "junkRemoval", label: "Junk Removal", icon: Trash2, desc: "Dispose of unwanted items before moving." },
    { id: "assemblyService", label: "Furniture Assembly", icon: Wrench, desc: "TV mounting & furniture setup." },
    { id: "storageService", label: "Vaulted Storage", icon: Warehouse, desc: "Secure, climate-controlled storage." },
    { id: "pianoMoving", label: "Piano Moving", icon: Music, desc: "Specialized handling for instruments." },
    { id: "expressMoving", label: "Express Moving", icon: Zap, desc: "Guaranteed fast delivery dates (25% fee)." },
  ];

  if (step === 6) {
    return (
      <Card className="border-none shadow-2xl bg-white p-12 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black text-primary mb-4 uppercase tracking-tighter">Estimate Ready!</h2>
        <p className="text-muted-foreground mb-8 text-balance">
          Thank you, {watch("name")}! {user ? "Your quote has been added to your account." : "We've created your secure account and saved your quote."} 
          You can now review your price and book your move directly from your dashboard.
        </p>
        <Button asChild className="bg-primary rounded-full px-12 h-12 font-bold uppercase tracking-widest text-xs">
          <Link href="/dashboard/customer">Go to My Dashboard</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-2xl bg-white overflow-hidden">
      <div className="h-2 bg-gray-100">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <CardContent className="p-8 md:p-12">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Logistics */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><MapPin className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Where are you moving?</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="pickupZip">Pickup Zip Code</Label>
                  <Input id="pickupZip" {...register("pickupZip")} placeholder="e.g. 75201" className="h-12" />
                  {errors.pickupZip && <p className="text-xs text-destructive font-bold">{errors.pickupZip.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoffZip">Dropoff Zip Code</Label>
                  <Input id="dropoffZip" {...register("dropoffZip")} placeholder="e.g. 10001" className="h-12" />
                  {errors.dropoffZip && <p className="text-xs text-destructive font-bold">{errors.dropoffZip.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moveDate">Move Date</Label>
                <Input id="moveDate" type="date" {...register("moveDate")} className="h-12" />
                {errors.moveDate && <p className="text-xs text-destructive font-bold">{errors.moveDate.message}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Size */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">What are we moving?</h3>
              </div>
              <div className="space-y-2">
                <Label>Home Size</Label>
                <Select onValueChange={(val) => setValue("moveSize", val)} defaultValue={watch("moveSize")}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select home size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="studio">Studio / 1-Bedroom</SelectItem>
                    <SelectItem value="2br">2 Bedroom Home</SelectItem>
                    <SelectItem value="3br">3+ Bedroom Home</SelectItem>
                    <SelectItem value="4br+">4+ Bedroom Home</SelectItem>
                    <SelectItem value="commercial">Commercial/Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialItems">Special Items (Optional)</Label>
                <Textarea 
                  id="specialItems" 
                  {...register("specialItems")} 
                  placeholder="Piano, Pool Table, Fine Art, Gun Safe, etc." 
                  className="min-h-[120px] border-gray-200"
                />
              </div>
            </div>
          )}

          {/* Step 3: Add-ons */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-accent/10 p-2 rounded-lg text-accent"><Sparkles className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Premium Add-ons</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Select additional services to make your move completely stress-free.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addOns.map((addon) => {
                  const isChecked = watch(addon.id as any);
                  return (
                    <div 
                      key={addon.id} 
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${isChecked ? 'bg-accent/5 border-accent shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className="pt-0.5">
                        <Checkbox 
                          id={addon.id} 
                          checked={isChecked} 
                          onCheckedChange={(val) => setValue(addon.id as any, val === true)} 
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={addon.id} className="cursor-pointer space-y-1 block">
                          <div className="flex items-center gap-2">
                            <addon.icon className={`h-4 w-4 ${isChecked ? 'text-accent' : 'text-muted-foreground'}`} />
                            <span className="font-bold text-sm">{addon.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">{addon.desc}</p>
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Contact & Account */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><User className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Who should we contact?</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...register("name")} placeholder="John Doe" className="h-12" />
                  {errors.name && <p className="text-xs text-destructive font-bold">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" {...register("phone")} placeholder="(555) 000-0000" className="h-12" />
                  {errors.phone && <p className="text-xs text-destructive font-bold">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register("email")} placeholder="john@example.com" className="h-12" />
                {errors.email && <p className="text-xs text-destructive font-bold">{errors.email.message}</p>}
              </div>

              {!user && (
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Lock className="h-4 w-4" />
                    <h4 className="text-sm font-black uppercase tracking-widest">Create Secure Account</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Please create a password to track your quote and manage your move.</p>
                  <div className="space-y-2">
                    <Label htmlFor="password">Account Password</Label>
                    <Input id="password" type="password" {...register("password")} placeholder="Min 8 characters" className="h-12" />
                    {errors.password && <p className="text-xs text-destructive font-bold">{errors.password.message}</p>}
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Apply Discounts (5%)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${watch("isStudent") ? 'bg-accent/5 border-accent' : 'bg-white border-gray-100'}`}>
                    <Checkbox id="isStudent" checked={watch("isStudent")} onCheckedChange={(val) => setValue("isStudent", val === true)} />
                    <Label htmlFor="isStudent" className="text-xs font-bold flex items-center gap-2 cursor-pointer">
                      <GraduationCap className="h-4 w-4" /> Student
                    </Label>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${watch("isMilitary") ? 'bg-accent/5 border-accent' : 'bg-white border-gray-100'}`}>
                    <Checkbox id="isMilitary" checked={watch("isMilitary")} onCheckedChange={(val) => setValue("isMilitary", val === true)} />
                    <Label htmlFor="isMilitary" className="text-xs font-bold flex items-center gap-2 cursor-pointer">
                      <Shield className="h-4 w-4" /> Military
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><Package className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Review Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">From</p>
                  <p className="font-bold text-primary">{watch("pickupZip")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">To</p>
                  <p className="font-bold text-primary">{watch("dropoffZip")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Date</p>
                  <p className="font-bold text-primary">{watch("moveDate")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Size</p>
                  <p className="font-bold text-primary capitalize">{watch("moveSize")}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Premium Services Selected</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {addOns.filter(a => watch(a.id as any)).length > 0 ? (
                      addOns.filter(a => watch(a.id as any)).map(a => (
                        <span key={a.id} className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-[10px] font-bold uppercase">{a.label}</span>
                      ))
                    ) : (
                      <span className="text-xs italic text-muted-foreground">No premium add-ons selected.</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Account Status</p>
                  <p className="font-bold text-primary">{watch("name")} • {watch("email")}</p>
                  {user ? (
                    <p className="text-[10px] text-green-600 font-black uppercase mt-1">Logged into existing account</p>
                  ) : (
                    <p className="text-[10px] text-accent font-black uppercase mt-1">New account will be created</p>
                  )}
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-xl text-xs text-primary leading-relaxed">
                By clicking "Submit Request", you agree to our <Link href="/terms" className="underline font-bold">terms of service</Link>.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-12">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={prevStep} className="flex items-center gap-2 font-bold h-12">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : <div />}

            {step < totalSteps ? (
              <Button type="button" onClick={nextStep} className="bg-primary rounded-full px-10 h-12 font-bold flex items-center gap-2 shadow-lg shadow-primary/10">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-accent/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : "Submit Request"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
