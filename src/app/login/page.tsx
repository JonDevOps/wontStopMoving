
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Phase 1 Mock logic: Simple redirect based on email prefix
    // Phase 2 will implement real Firebase Auth and Firestore role checking
    if (email.startsWith('admin')) router.push('/dashboard/admin');
    else if (email.startsWith('emp')) router.push('/dashboard/employee');
    else router.push('/dashboard/customer');
  };

  return (
    <PublicLayout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden px-4 pt-20">
        {/* Decorative patterns */}
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
                  <Link href="/forgot-password" size="sm" className="text-xs text-accent font-bold hover:underline">Forgot?</Link>
                </div>
                <Input id="password" type="password" className="h-12 border-gray-200" required />
              </div>
              <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-lg uppercase">
                Sign In
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground font-bold">Or continue with</span></div>
            </div>

            <Button variant="outline" className="w-full h-12 border-gray-200 rounded-xl gap-3 text-primary font-bold">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google OAuth
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account? <Link href="/signup" className="text-accent font-bold hover:underline">Create Account</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
