
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, AlertCircle } from "lucide-react";
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

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
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
            <CardContent className="p-8 sm:p-12">
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
                          <DialogContent className="max-w-3xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Terms of Service</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-[50vh] pr-4 mt-4">
                              <div className="prose prose-sm prose-primary max-w-none space-y-4 text-muted-foreground">
                                <p className="font-bold text-primary">Last Updated: March 2024</p>
                                <h3 className="text-primary font-black uppercase">1. Provider Standards</h3>
                                <p>As a Wont Stop Moving® Service Provider, you agree to maintain professional standards of conduct and quality. All moves must be performed by background-checked individuals.</p>
                                <h3 className="text-primary font-black uppercase">2. Independent Status</h3>
                                <p>You understand that applying as a Provider means you are an independent moving labor service. You are not an employee of Wont Stop Moving® Inc. or its affiliates.</p>
                                <h3 className="text-primary font-black uppercase">3. Data Accuracy</h3>
                                <p>You verify that all information provided during this application is true and accurate. Misrepresentation of qualifications will result in immediate account termination.</p>
                                <h3 className="text-primary font-black uppercase">4. Communication</h3>
                                <p>You consent to receive electronic communications via email and SMS regarding job assignments, system updates, and logistics coordination.</p>
                              </div>
                            </ScrollArea>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" className="bg-primary text-white rounded-full px-8">
                                  I have read the terms
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
