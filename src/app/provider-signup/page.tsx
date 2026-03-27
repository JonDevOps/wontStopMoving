"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { ArrowLeft, AlertCircle, UserPlus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useFirestore, useAuth } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PublicLayout } from "@/components/layout/public-layout";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,30}$/;

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Invalid phone number"),
  password: z.string().regex(
    passwordRegex,
    "Password must be 8-30 characters, contain 1 uppercase, 1 lowercase, 1 number and 1 special character"
  ),
  agreeTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export default function ProviderSignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [termsOpened, setTermsOpened] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [existingAccountError, setExistingAccountError] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      agreeTerms: false
    }
  });

  const onSubmit = async (data: SignUpValues) => {
    if (!termsOpened) {
      setTermsError("You must review the terms and conditions prior to agreeing");
      return;
    }
    setTermsError(null);
    setExistingAccountError(false);
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Create User Profile
      await setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'provider',
        state: "Pending",
        createdAt: serverTimestamp(),
      });

      // Create Provider Record
      await setDoc(doc(firestore, "providers", user.uid), {
        uid: user.uid,
        businessName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        status: "pending",
        isEmployee: false,
        services: [],
        rating: 0,
        reviewCount: 0,
        termsAccepted: true,
        onboardingStep: 2,
        onboarding: {
          signupDate: serverTimestamp(),
          insuranceUploaded: false,
          licenseVerified: false,
          selfieUploaded: false,
          idFrontUploaded: false,
          idBackUploaded: false
        }
      });

      toast({
        title: "Account Created",
        description: "Moving to Phase 2: Your Details.",
      });
      
      router.push('/provider-signup/details');

      router.push('/provider-signup/details');

    } catch (error: any) {
      console.error("Signup Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setExistingAccountError(true);
        toast({
          variant: "destructive",
          title: "Account Already Exists",
          description: "Our records indicate an existing account with this email. Please sign in.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Registration Error",
          description: error.message || "Failed to create account.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsClick = () => {
    setTermsOpened(true);
    setTermsError(null);
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-2 text-primary font-bold mb-8 hover:text-accent transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
            </Link>
  
            <div className="mb-12 text-center">
              <div className="mx-auto bg-primary text-white p-4 rounded-3xl w-fit mb-6 shadow-xl shadow-primary/20 rotate-3">
                <UserPlus className="h-10 w-10" />
              </div>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-[0.2em]">Phase 1</span>
                <h1 className="text-4xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Become a <span className="text-accent">Provider</span></h1>
              </div>
              <p className="text-muted-foreground font-medium text-lg">Join the nation's premium moving network and start earning.</p>
            </div>
  
            <Card className="border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl rounded-[2.5rem]">
              <div className="h-2 bg-gray-100 flex">
                <div className="h-full bg-accent w-1/3 transition-all duration-700 ease-in-out" />
              </div>
              <CardContent className="p-8 sm:p-14">
                {existingAccountError && (
                  <Alert variant="destructive" className="mb-8 border-red-200 bg-red-50 text-red-900 rounded-2xl p-6">
                    <AlertCircle className="h-6 w-6" />
                    <AlertTitle className="font-black uppercase tracking-tight text-lg">Account Already Exists</AlertTitle>
                    <AlertDescription className="text-sm font-medium mt-1">
                      Our records indicate an existing account with this email. Please <Link href="/login" className="font-bold underline">sign in</Link> or contact <span className="font-bold">support@wontstopmoving.com</span>.
                    </AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">First Name</Label>
                      <Input id="firstName" {...register("firstName")} placeholder="Jane" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                      {errors.firstName && <p className="text-xs text-destructive font-bold">{errors.firstName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Last Name</Label>
                      <Input id="lastName" {...register("lastName")} placeholder="Doe" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                      {errors.lastName && <p className="text-xs text-destructive font-bold">{errors.lastName.message}</p>}
                    </div>
                  </div>
  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Email Address</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                    {errors.email && <p className="text-xs text-destructive font-bold">{errors.email.message}</p>}
                  </div>
  
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Phone Number</Label>
                    <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                    {errors.phone && <p className="text-xs text-destructive font-bold">{errors.phone.message}</p>}
                  </div>
  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Security Password</Label>
                    <Input id="password" type="password" {...register("password")} className="h-14 border-gray-100 bg-gray-50/50 rounded-xl focus:ring-accent focus:border-accent font-medium" />
                    <div className="flex items-center gap-2 mt-2">
                      <ShieldCheck className="h-3 w-3 text-slate-300" />
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">8-30 chars, Mix of Case, Num & Special</p>
                    </div>
                    {errors.password && <p className="text-xs text-destructive font-bold leading-tight mt-1">{errors.password.message}</p>}
                  </div>
  
                  <div className="pt-6 border-t border-gray-50">
                    <div className="flex items-start space-x-4 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <Checkbox 
                        id="agreeTerms" 
                        onCheckedChange={(val) => setValue("agreeTerms", val === true)} 
                        className="mt-1 w-5 h-5 rounded-md border-slate-200"
                      />
                      <div className="space-y-1.5 leading-none">
                        <Label htmlFor="agreeTerms" className="text-sm font-bold text-slate-600 leading-relaxed cursor-pointer">
                          I agree to the Wont Stop Moving®{" "}
                          <Dialog>
                            <DialogTrigger asChild>
                              <button 
                                type="button" 
                                onClick={handleTermsClick}
                                className="text-accent font-black hover:underline underline-offset-4 decoration-2"
                              >
                                Affiliate Service Agreement
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                              <DialogHeader className="p-8 border-b shrink-0 bg-white z-10">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Service Agreement</DialogTitle>
                              </DialogHeader>
                              
                              <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-8 bg-white font-medium text-slate-600 leading-relaxed">
                                <div className="prose prose-slate max-w-none">
                                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                                    <h2 className="text-primary font-black uppercase text-xl mb-1">Affiliate Partnership</h2>
                                    <p className="font-bold text-accent uppercase tracking-widest text-[10px]">Effective Update: October 2023</p>
                                  </div>
  
                                  <section className="space-y-4">
                                    <h3 className="text-primary font-black uppercase text-sm tracking-widest">1. Marketplace Protocol</h3>
                                    <p>By accessing the Wont Stop Moving® Network, you agree to operate as an independent service provider. We function as a neutral technology platform connecting you with customers. You are responsible for your own tools, equipment, and professional conduct.</p>
                                  </section>
  
                                  <section className="space-y-4">
                                    <h3 className="text-primary font-black uppercase text-sm tracking-widest">2. Compensation & Fees</h3>
                                    <p>The marketplace fee is automatically set at 15% of the gross booking value. Payouts are processed via Stripe Connect upon successful job completion and customer verification.</p>
                                  </section>
  
                                  <section className="space-y-4">
                                    <h3 className="text-primary font-black uppercase text-sm tracking-widest">3. Identity Verification</h3>
                                    <p>To maintain network safety, all providers must undergo identity verification, including selfie matching and government ID checks. Failure to provide accurate information will result in immediate account suspension.</p>
                                  </section>
                                  
                                  <div className="py-12 flex justify-center opacity-20">
                                    <div className="h-px bg-slate-900 w-full max-w-xs" />
                                  </div>
                                </div>
                              </div>
  
                              <DialogFooter className="p-8 border-t bg-slate-50 shrink-0">
                                <DialogClose asChild>
                                  <Button type="button" className="bg-primary hover:bg-primary/90 text-white rounded-xl px-10 h-14 font-black uppercase tracking-[0.2em] text-xs w-full sm:w-auto shadow-xl shadow-primary/20">
                                    Accept & Close Agreement
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </Label>
                        {errors.agreeTerms && <p className="text-xs text-destructive font-bold mt-2">{errors.agreeTerms.message}</p>}
                        {termsError && !errors.agreeTerms && <p className="text-xs text-destructive font-bold mt-2">{termsError}</p>}
                      </div>
                    </div>
                  </div>
  
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-accent hover:bg-accent/90 min-h-[4rem] text-xl font-black rounded-2xl uppercase tracking-[0.2em] shadow-2xl shadow-accent/30 mt-6 transition-all hover:scale-[1.02] active:scale-95 px-8"
                  >
                    {isLoading ? "Validating Account..." : "Create My Business Account"}
                  </Button>
                </form>
  
                <div className="mt-10 pt-10 border-t border-gray-50 flex flex-col items-center gap-4">
                  <p className="text-center font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em]">
                    Already part of the network?
                  </p>
                  <Link href="/login" className="text-primary font-black uppercase tracking-widest text-xs hover:text-accent transition-colors flex items-center gap-2">
                    Back to Sign In <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

