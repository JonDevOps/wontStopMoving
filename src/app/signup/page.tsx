
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/public-layout";
import { useAuth, useFirestore } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { sendSignupVerification } from '@/lib/email-verification';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { ALL_LOCATIONS } from "@/lib/location-data";
import { GoogleButton } from "@/components/auth/google-button";
import {
  signInWithGooglePopup,
  getProfileRole,
  createSelfServiceProfile,
  dashboardForRole,
  googleErrorMessage,
} from "@/lib/google-sign-in";

const signupSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  state: z.string().min(1, "Select state"),
  accountType: z.enum(['customer', 'provider']).default('customer'),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      accountType: 'customer',
    },
  });

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithGooglePopup(auth);
      const existingRole = await getProfileRole(firestore, user.uid);
      if (existingRole) {
        // Already has an account: just sign them in.
        router.push(dashboardForRole(existingRole));
        return;
      }
      const role = getValues("accountType") === "provider" ? "provider" : "customer";
      await createSelfServiceProfile(firestore, user, { role, state: getValues("state") || "" });
      toast({
        title: "Account Created",
        description: role === "provider" ? "Your provider account is pending admin approval." : "Welcome to Wont Stop Moving!",
      });
      router.push(dashboardForRole(role));
    } catch (error: unknown) {
      const message = googleErrorMessage(error);
      if (message) {
        toast({ variant: "destructive", title: "Registration Failed", description: message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: SignupValues) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Create User Profile in Firestore
      const userRef = doc(firestore, "users", user.uid);
      await setDoc(userRef, {
        id: user.uid,
        email: data.email,
        name: data.name,
        role: data.accountType,
        state: data.state,
        createdAt: serverTimestamp(),
      });

      const verificationSent = await sendSignupVerification(user);
      toast({ title: 'Verify your email', description: verificationSent
        ? 'Check your inbox for a verification link. You can continue to your dashboard.'
        : 'Your account is created. You can resend the verification email from your dashboard.' });

      if (data.accountType === 'provider') {
        const providerRef = doc(firestore, "providers", user.uid);
        await setDoc(providerRef, {
          uid: user.uid,
          businessName: data.name, // Can be updated later
          email: data.email,
          status: "pending",
          isEmployee: false,
          services: [],
          rating: 0,
          reviewCount: 0,
          onboarding: {
            signupDate: new Date().toISOString(),
            insuranceUploaded: false,
            licenseVerified: false
          }
        });
        toast({
          title: "Account Created",
          description: "Your provider account is pending admin approval.",
        });
        router.push('/dashboard/provider');
      } else {
        router.push('/dashboard/customer');
      }
    } catch (error: any) {
      console.error("Signup failed:", error?.code || 'unknown');
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not create account.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden px-4 pt-20">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 bg-accent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <Card className="w-full max-w-md border-none shadow-2xl relative z-10 bg-white my-12">
          <CardHeader className="space-y-4 text-center pt-10">
            <div className="mx-auto bg-primary text-white p-3 rounded-2xl w-fit">
              <UserPlus className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Customer <span className="text-accent">Sign Up</span></h1>
              <p className="text-muted-foreground text-sm">Create your customer account to book and track moves</p>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <GoogleButton onClick={handleGoogleSignup} disabled={isLoading} label="Sign up with Google" />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-100"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-muted-foreground font-bold">or use email</span>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register("name")} placeholder="Jane Doe" className="h-12 border-gray-200" required />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" className="h-12 border-gray-200" required />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State / Province</Label>
                <Select onValueChange={(val) => setValue("state", val)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your region" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_LOCATIONS.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register("password")} className="h-12 border-gray-200" required />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-lg uppercase">
                {isLoading ? "Creating Account..." : "Create Customer Account"}
              </Button>
            </form>

            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link href="/login?role=customer" className="text-accent font-bold hover:underline">Customer Sign In</Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Joining the team? <Link href="/careers/apply" className="text-primary font-bold hover:underline">Employee Sign Up</Link>
                {" • "}
                <Link href="/provider-signup" className="text-primary font-bold hover:underline">Provider Sign Up</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
