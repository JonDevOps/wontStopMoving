"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Truck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { useAuth } from "@/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setIsSent(true);
      toast({
        title: "Email Sent!",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: error.message || "An error occurred while sending the email.",
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
              <h1 className="text-3xl font-black text-primary tracking-tighter">Reset Password</h1>
              <p className="text-muted-foreground text-sm mt-2">Enter your email to receive a reset link.</p>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {!isSent ? (
               <form onSubmit={handleReset} className="space-y-6">
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
                 
                 <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-lg uppercase">
                   {isLoading ? "Sending..." : "Send Reset Link"}
                 </Button>
               </form>
            ) : (
               <div className="text-center space-y-4 py-4">
                 <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100">
                   <p className="font-bold">Check your email!</p>
                   <p className="text-sm mt-1">If an account exists for {email}, you will receive a password reset link shortly.</p>
                 </div>
               </div>
            )}

            <div className="pt-2">
              <Button asChild variant="ghost" className="w-full h-12 text-muted-foreground hover:text-primary">
                <Link href="/login" className="flex items-center justify-center"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
