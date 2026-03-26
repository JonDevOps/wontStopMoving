
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/public-layout";
import { useAuth, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Role Resolver Logic
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      
      if (!userDoc.exists()) {
        toast({
          variant: "destructive",
          title: "Profile Error",
          description: "No user profile found. Please contact support.",
        });
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;

      if (role === 'admin') router.push('/dashboard/admin');
      else if (role === 'employee') router.push('/dashboard/employee');
      else router.push('/dashboard/customer');

    } catch (error: any) {
      console.error("Login Error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid email or password.",
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
              <Truck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Welcome <span className="text-accent">Back</span></h1>
              <p className="text-muted-foreground text-sm">Access your Wont Stop Moving dashboard</p>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-gray-200" 
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-accent font-bold hover:underline">Forgot?</Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-200" 
                  required 
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-lg uppercase">
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground font-bold">New to the Movement?</span></div>
            </div>

            <Button asChild variant="outline" className="w-full h-12 border-gray-200 rounded-xl gap-3 text-primary font-bold">
              <Link href="/signup">Create Customer Account</Link>
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Interested in joining our team? <Link href="/careers" className="text-accent font-bold hover:underline">View Careers</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
