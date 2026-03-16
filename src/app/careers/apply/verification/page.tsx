
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import Image from "next/image";

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
      title: "Application Submitted",
      description: "Redirecting to your onboarding dashboard.",
    });
    setTimeout(() => {
      router.push('/dashboard/employee');
    }, 1500);
  };

  if (isUserLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-primary font-bold uppercase tracking-widest text-xs">Verifying session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-10 pb-24">
      <div className="container mx-auto px-4 max-w-2xl">
        
        {/* Stepper */}
        <div className="mb-16 relative">
          <div className="flex justify-between items-center relative z-10 px-4">
            {[
              { label: "Create Account", active: true, done: true },
              { label: "Your Details", active: true, done: true },
              { label: "ID Verification", active: true, done: false },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${step.done ? 'bg-primary border-primary text-white shadow-lg' : step.active ? 'bg-white border-primary text-primary shadow-md' : 'bg-white border-gray-200 text-gray-400'}`}>
                  {step.done ? <CheckCircle2 className="h-6 w-6" /> : <span className="text-sm font-black">{i + 1}</span>}
                </div>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center ${step.active ? 'text-primary' : 'text-gray-400'}`}>{step.label}</span>
              </div>
            ))}
          </div>
          {/* Progress bar background */}
          <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 -z-0">
            <div className="h-full bg-primary transition-all duration-700" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-black text-primary uppercase tracking-tight mb-4">PHOTO AND DOCUMENT UPLOADS</h1>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            For security purposes, all uploaded files will be deleted after the Wont Stop Moving® Support Team has reviewed them.
          </p>
        </div>

        <div className="space-y-8">
          <Card className="border-2 border-primary/10 rounded-none shadow-xl bg-white overflow-hidden">
            <div className="p-5 border-b bg-gray-50/50">
              <h2 className="text-xl font-black text-primary uppercase tracking-tight">Identification Verification</h2>
            </div>
            <CardContent className="p-0">
              <Accordion type="multiple" defaultValue={["selfie", "front", "back"]} className="divide-y divide-gray-100">
                
                {/* Selfie */}
                <AccordionItem value="selfie" className="border-none px-6 py-6 group">
                  <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-black text-primary uppercase text-sm tracking-tight group-hover:text-accent transition-colors">Selfie With Identification Card</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Please upload a selfie with your Driver's License or Government Issued Identification Card. 
                      Make sure you are in a well lit area and if you are wearing a hat, mask, sunglasses, or transition glasses, please remove them before taking your picture.
                      <button className="inline-flex items-center gap-1 text-accent font-black ml-2 hover:underline uppercase text-[10px] tracking-widest">
                        <HelpCircle className="h-3 w-3" /> See Example
                      </button>
                    </p>
                    <div className="flex justify-end pt-2">
                      <Button className="bg-accent hover:bg-accent/90 text-white rounded-lg px-8 h-11 gap-2 font-black uppercase text-xs tracking-widest shadow-lg shadow-accent/20">
                        <Upload className="h-4 w-4" /> Upload
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Front */}
                <AccordionItem value="front" className="border-none px-6 py-6 group">
                  <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-black text-primary uppercase text-sm tracking-tight group-hover:text-accent transition-colors">Identification Card - Front</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Please upload a photo of the front of your Driver's License or Government Issued Identification Card. 
                      This will be used to help Wont Stop Moving® identify you and compare against your selfie.
                      <button className="inline-flex items-center gap-1 text-accent font-black ml-2 hover:underline uppercase text-[10px] tracking-widest">
                        <HelpCircle className="h-3 w-3" /> See Example
                      </button>
                    </p>
                    <div className="flex justify-end pt-2">
                      <Button className="bg-accent hover:bg-accent/90 text-white rounded-lg px-8 h-11 gap-2 font-black uppercase text-xs tracking-widest shadow-lg shadow-accent/20">
                        <Upload className="h-4 w-4" /> Upload
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Back */}
                <AccordionItem value="back" className="border-none px-6 py-6 group">
                  <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-black text-primary uppercase text-sm tracking-tight group-hover:text-accent transition-colors">Identification Card - Back</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-6">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Please scan the below QR code using a mobile device to login and complete this step. 
                      You will need the email address and password entered upon sign up to login. 
                      To receive a texted URL, please <button className="text-accent font-black hover:underline uppercase text-[10px] tracking-widest">click here</button>.
                    </p>
                    <div className="flex justify-center py-6 bg-white border-2 border-dashed border-gray-100 rounded-2xl max-w-xs mx-auto">
                      <div className="relative w-48 h-48 group/qr">
                        {/* Placeholder QR Code */}
                        <Image 
                          src="https://picsum.photos/seed/qrcode/400/400" 
                          alt="QR Code for mobile login" 
                          fill 
                          className="object-contain group-hover/qr:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>

          <div className="space-y-6 pt-10 px-2">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Button variant="outline" className="border-primary/20 text-primary font-black h-14 px-8 rounded-xl flex-1 uppercase tracking-widest text-xs hover:bg-primary/5 transition-all">
                Save & Continue Later
              </Button>
              <Button 
                onClick={handleFinish}
                disabled={isLoading}
                className="bg-accent hover:bg-accent/90 text-white font-black h-14 px-8 rounded-xl uppercase tracking-widest text-xs shadow-xl shadow-accent/30 flex-1 transition-all active:scale-[0.98]"
              >
                {isLoading ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
            <div className="flex justify-center sm:justify-end">
              <Button asChild variant="ghost" className="text-accent font-black hover:text-accent/80 p-0 h-auto gap-2 group uppercase text-[10px] tracking-widest">
                <Link href="/careers/apply/details">
                  <ArrowRight className="h-4 w-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Back to Your Details
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
