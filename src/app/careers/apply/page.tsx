"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { ArrowLeft, AlertCircle, Truck } from "lucide-react";
import Link from "next/link";
import { useFirestore, useAuth } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export default function EmployeeSignUpPage() {
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

      await setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'employee',
        state: "Pending",
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(firestore, "employees", user.uid), {
        id: user.uid,
        userId: user.uid,
        status: 'applicant',
        onboardingStep: 2,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Account Created",
        description: "Moving to Phase 2: Your Details.",
      });
      
      router.push('/careers/apply/details');

    } catch (error: any) {
      console.error("Signup Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setExistingAccountError(true);
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
    <div className="min-h-screen bg-gray-50 pt-20 pb-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/careers" className="inline-flex items-center gap-2 text-primary font-bold mb-8 hover:text-accent transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Careers
          </Link>

          <div className="mb-12 text-center">
            <div className="bg-primary text-white p-3 rounded-2xl w-fit mx-auto mb-6">
              <Truck className="h-8 w-8" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">Phase 1</span>
              <h1 className="text-3xl sm:text-4xl font-black text-primary uppercase">Provider <span className="text-accent">Sign Up</span></h1>
            </div>
            <p className="text-muted-foreground font-medium">Create your secure account to join our 51,000+ member network.</p>
          </div>

          {existingAccountError && (
            <Alert variant="destructive" className="mb-8 border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-black uppercase tracking-tight">Existing Account Found</AlertTitle>
              <AlertDescription className="text-sm font-medium">
                Our records indicate your information matches an existing Wont Stop Moving account. Please email <span className="font-bold">support@wontstopmoving.com</span> for further instructions.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <div className="h-1.5 bg-gray-100">
              <div className="h-full bg-accent w-1/3 transition-all duration-500" />
            </div>
            <CardContent className="p-6 sm:p-12">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">First Name</Label>
                    <Input id="firstName" {...register("firstName")} placeholder="Jane" className="h-12 border-gray-200 focus:ring-accent" />
                    {errors.firstName && <p className="text-xs text-destructive font-bold">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Last Name</Label>
                    <Input id="lastName" {...register("lastName")} placeholder="Doe" className="h-12 border-gray-200 focus:ring-accent" />
                    {errors.lastName && <p className="text-xs text-destructive font-bold">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Email Address</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" className="h-12 border-gray-200 focus:ring-accent" />
                  {errors.email && <p className="text-xs text-destructive font-bold">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                  <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" className="h-12 border-gray-200 focus:ring-accent" />
                  {errors.phone && <p className="text-xs text-destructive font-bold">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input id="password" type="password" {...register("password")} className="h-12 border-gray-200 focus:ring-accent" />
                  <p className="text-[10px] text-muted-foreground font-medium">Must be 8-30 characters with uppercase, lowercase, number, and special character.</p>
                  {errors.password && <p className="text-xs text-destructive font-bold leading-tight">{errors.password.message}</p>}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="agreeTerms" 
                      onCheckedChange={(val) => setValue("agreeTerms", val === true)} 
                      className="mt-1"
                    />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="agreeTerms" className="text-sm font-medium text-primary leading-relaxed">
                        I agree to Wont Stop Moving®{" "}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button 
                              type="button" 
                              onClick={handleTermsClick}
                              className="text-accent font-black hover:underline underline-offset-2"
                            >
                              Terms of Service
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="p-6 border-b shrink-0 bg-white z-10">
                              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Terms of Service</DialogTitle>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-white">
                              <div className="prose prose-sm prose-primary max-w-none text-muted-foreground">
                                <div>
                                  <h2 className="text-primary font-black uppercase text-lg">Wont Stop Moving® Affiliate Agreement</h2>
                                  <p className="font-bold text-primary">Effective July 26, 2023</p>
                                </div>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">AGREEMENT:</h3>
                                  <p>You acknowledge and agree to the following terms and conditions when You use the Wont Stop Moving® MarketPlace. Our responsibilities are specific and limited to the terms of this Agreement. You must read, agree with, and accept all of the terms and conditions contained in this Agreement which are those terms, conditions and definitions expressly set out below.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">1. Arbitration Agreement:</h3>
                                  <p><strong>YOU ACKNOWLEDGE AND AGREE THAT THIS AGREEMENT INCLUDES THE WONT STOP MOVING COMMERCIAL ARBITRATION AGREEMENT, THAT GOVERNS ANY DISPUTES BETWEEN YOU AND WONT STOP MOVING, INC.</strong> This arbitration agreement will eliminate your right to a jury trial and substantially affect your rights, including preventing you from bringing, joining, or participating in class action or consolidated proceedings.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">2. Definitions:</h3>
                                  <ul className="list-disc pl-5">
                                    <li><strong>"You", "mover", "service provider"</strong> - you, individually, or for an entity, providing labor services to the public via our marketplace.</li>
                                    <li><strong>"We", "Us", "Our"</strong> - WONT STOP MOVING, Inc., a Delaware Corporation.</li>
                                    <li><strong>"MarketPlace"</strong> - Our online platform located at www.wontstopmoving.com.</li>
                                  </ul>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">3. Professional Status:</h3>
                                  <p>We function solely as a neutral venue and online clearinghouse. You do not work for Us or represent Us. You agree that We are not your employer. We do not provide any endorsement for You or Your Services.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">4. Labor Only:</h3>
                                  <p>You agree that the MarketPlace is a place where You offer labor services only and that the Services that You provide will only involve labor.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">5. MarketPlace Fee:</h3>
                                  <p>You acknowledge and agree that We shall receive a "MarketPlace Fee" calculated as a 15% cut from the total amount paid by the Customer for the Services. This is deducted from the payout, not added to the customer total.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">6. Confidentiality:</h3>
                                  <p>You agree that all Our documents, source code, business practices, and systems are Our sole and exclusive intellectual property. Unauthorized disclosure is strictly prohibited.</p>
                                </section>

                                <div className="text-[10px] text-center opacity-50 uppercase font-bold py-8">
                                  Full Affiliate Agreement Version 2023.07.26 - All Rights Reserved
                                </div>
                              </div>
                            </div>

                            <DialogFooter className="p-6 border-t bg-gray-50 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                              <DialogClose asChild>
                                <Button type="button" className="bg-primary text-white rounded-xl px-8 h-12 font-bold uppercase tracking-widest text-xs w-full sm:w-auto shadow-lg">
                                  I have read and accept the affiliate terms
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </Label>
                      {errors.agreeTerms && <p className="text-xs text-destructive font-bold">{errors.agreeTerms.message}</p>}
                      {termsError && !errors.agreeTerms && <p className="text-xs text-destructive font-bold">{termsError}</p>}
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/90 min-h-14 text-lg font-black rounded-xl uppercase tracking-widest shadow-xl shadow-accent/20 mt-4 px-6"
                >
                  {isLoading ? "Processing..." : "Create Account & Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
