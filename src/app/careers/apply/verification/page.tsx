
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Upload, ArrowRight, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeVerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
  }, [user, isUserLoading, router]);

  const handleFinish = () => {
    setIsLoading(true);
    toast({
      title: "Application Under Review",
      description: "Redirecting to your onboarding dashboard.",
    });
    setTimeout(() => {
      router.push('/dashboard/employee');
    }, 1500);
  };

  if (isUserLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Verifying session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">Phase 3</span>
              <h1 className="text-3xl sm:text-4xl font-black text-primary uppercase">Identity <span className="text-accent">Verification</span></h1>
            </div>
            <p className="text-muted-foreground font-medium">Complete your security verification to activate your account.</p>
          </div>

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <div className="h-1.5 bg-gray-100">
              <div className="h-full bg-accent w-full transition-all duration-500" />
            </div>
            <CardContent className="p-8 sm:p-12 text-center space-y-8">
              <div className="w-24 h-24 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-12 w-12" />
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase">Ready for Verification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To ensure the safety of our customers and community, we require all providers to verify their identity. 
                  You'll need a valid government-issued ID (Driver's License or Passport).
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4">
                <div className="p-6 border-2 border-dashed border-gray-200 rounded-3xl space-y-3 group hover:border-accent transition-colors cursor-pointer">
                  <Camera className="h-8 w-8 text-muted-foreground group-hover:text-accent mx-auto" />
                  <p className="font-bold text-sm text-primary uppercase">Take a Photo</p>
                </div>
                <div className="p-6 border-2 border-dashed border-gray-200 rounded-3xl space-y-3 group hover:border-accent transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground group-hover:text-accent mx-auto" />
                  <p className="font-bold text-sm text-primary uppercase">Upload Document</p>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <Button 
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90 h-14 text-lg font-black rounded-xl uppercase tracking-widest group"
                >
                  {isLoading ? "Finalizing..." : (
                    <>
                      Complete Application <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-4">
                  Security verification powered by Wont Stop Moving® Trust Center
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
