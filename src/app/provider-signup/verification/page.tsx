"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  Loader2,
  HelpCircle,
  FileText,
  Camera,
  ShieldAlert
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PublicLayout } from "@/components/layout/public-layout";

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export default function ProviderVerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  
  const [isLoading, setIsLoading] = useState(false);
  const [uploads, setUploads] = useState<Record<string, { status: UploadStatus, preview?: string }>>({
    selfie: { status: 'idle' },
    idFront: { status: 'idle' },
    idBack: { status: 'idle' },
  });

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Sync state with Firestore
  useEffect(() => {
    if (!user || !firestore) return;

    const syncStatus = async () => {
      try {
        const providerRef = doc(firestore, "providers", user.uid);
        const snap = await getDoc(providerRef);
        if (snap.exists()) {
          const data = snap.data();
          const onboarding = data.onboarding || {};
          setUploads({
            selfie: { status: onboarding.selfieUploaded ? 'done' : 'idle' },
            idFront: { status: onboarding.idFrontUploaded ? 'done' : 'idle' },
            idBack: { status: onboarding.idBackUploaded ? 'done' : 'idle' },
          });
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
    };

    syncStatus();
  }, [user, firestore]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
  }, [user, isUserLoading, router]);

  const handleFileUpload = async (field: string, file: File) => {
    if (!user || !file || !firestore || !storage) return;

    // Create a local preview for immediate feedback
    const previewUrl = URL.createObjectURL(file);
    setUploads(prev => ({ ...prev, [field]: { status: 'uploading', preview: previewUrl } }));

    try {
      // 1. Create a storage reference
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const storagePath = `providers/${user.uid}/verification/${field}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);

      // 2. Upload the file
      await uploadBytes(storageRef, file);

      // 3. Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // 4. Update Firestore with the real URL and metadata
      const providerRef = doc(firestore, "providers", user.uid);
      const data = {
        [`onboarding.${field}Url`]: downloadURL,
        [`onboarding.${field}Path`]: storagePath,
        [`onboarding.${field}Uploaded`]: true,
        [`onboarding.${field}At`]: new Date().toISOString(),
      };

      await updateDoc(providerRef, data);

      setUploads(prev => ({ ...prev, [field]: { status: 'done', preview: previewUrl } }));
      toast({
        title: "Document Secured",
        description: "Your document has been safely uploaded to our encrypted vault.",
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      setUploads(prev => ({ ...prev, [field]: { status: 'error' } }));
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "We couldn't process your file. Please try again.",
      });
    }
  };

  const handleFinish = async () => {
    const allDone = Object.values(uploads).every(u => u.status === 'done');
    if (!allDone) {
      toast({
        variant: "destructive",
        title: "Action Required",
        description: "Please upload all three verification documents to proceed.",
      });
      return;
    }

    setIsLoading(true);
    
    if (user) {
      try {
        const providerRef = doc(firestore, "providers", user.uid);
        await updateDoc(providerRef, {
          onboardingStep: 4,
          status: 'pending' 
        });
        
        toast({
          title: "Verification Submitted",
          description: "Redirecting to your dashboard.",
        });
        router.push('/dashboard/provider');
      } catch (error: any) {
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "We couldn't finalize your application. Please try again.",
        });
      }
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        <p className="mt-4 text-primary font-black uppercase tracking-widest text-xs">Synchronizing Identity...</p>
      </div>
    );
  }

  const renderUploadButton = (field: string, inputRef: React.RefObject<HTMLInputElement | null>) => {
    const status = uploads[field].status;
    
    return (
      <div className="flex flex-col items-start gap-2">
        <input 
          type="file" 
          hidden 
          ref={inputRef} 
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(field, file);
          }}
        />
        <Button 
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading'}
          className={`${status === 'done' ? 'bg-green-500 hover:bg-green-600' : 'bg-accent hover:bg-accent/90'} text-white rounded-[1rem] px-8 h-12 gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-accent/20 transition-all active:scale-95`}
        >
          {status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {status === 'uploading' ? "Encrypting..." : status === 'done' ? "Change Document" : "Select Document"}
        </Button>
      </div>
    );
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          
          {/* Stepper */}
          <div className="mb-16 relative">
            <div className="flex justify-between items-center relative z-10 px-4">
              {[
                { label: "Account", done: true },
                { label: "Details", done: true },
                { label: "Verification", active: true },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${step.done ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-110' : step.active ? 'bg-white border-accent text-accent shadow-lg shadow-accent/10 scale-110' : 'bg-white border-gray-200 text-gray-400'}`}>
                    {step.done ? <CheckCircle2 className="h-6 w-6" /> : <span className="text-sm font-black">{i + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${step.active || step.done ? 'text-primary' : 'text-gray-400'}`}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="absolute top-6 left-0 w-full h-[2px] bg-gray-200 -z-0">
              <div className="h-full bg-primary transition-all duration-700" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="text-center mb-16 px-4">
             <div className="mx-auto bg-amber-500/10 text-amber-600 p-4 rounded-3xl w-fit mb-6 animate-pulse">
                <ShieldAlert className="h-10 w-10" />
              </div>
            <h1 className="text-4xl sm:text-5xl font-black text-primary uppercase tracking-tighter mb-4">Identity <span className="text-accent">Verification</span></h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto font-medium">
              To maintain our premium network standards, we require high-resolution identification for all active providers.
            </p>
          </div>

          <div className="space-y-8">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
              <div className="p-8 sm:p-10 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tighter flex items-center gap-3">
                   <FileText className="h-6 w-6 text-accent" /> Security Protocol
                </h2>
                <div className="hidden sm:flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secure AES-256 Link</span>
                </div>
              </div>
              <CardContent className="p-4 sm:p-8">
                <Accordion type="multiple" defaultValue={["selfie", "front", "back"]} className="space-y-4">
                  
                  <AccordionItem value="selfie" className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white hover:border-accent/20 transition-all">
                    <AccordionTrigger className="hover:no-underline py-2 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${uploads.selfie.status === 'done' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-amber-400 animate-pulse'}`} />
                        <span className="font-black text-primary uppercase text-sm tracking-tight text-left">Live Identity Match (Selfie)</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative bg-slate-50 rounded-2xl w-full sm:w-48 aspect-square flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden group-hover:border-accent/30 transition-all">
                          {uploads.selfie.preview ? (
                            <img src={uploads.selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
                          ) : uploads.selfie.status === 'done' ? (
                             <CheckCircle2 className="h-12 w-12 text-green-500" />
                          ) : (
                            <Camera className="h-12 w-12 text-slate-300" />
                          )}
                          {uploads.selfie.status === 'uploading' && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-accent animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-4 pt-2">
                          <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Upload a photo of yourself holding your government-issued ID clearly visible next to your face. Ensure your features are unobstructed.
                          </p>
                          <div className="flex justify-start">
                            {renderUploadButton('selfie', selfieInputRef)}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="front" className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white hover:border-accent/20 transition-all">
                    <AccordionTrigger className="hover:no-underline py-2 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${uploads.idFront.status === 'done' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-amber-400'}`} />
                        <span className="font-black text-primary uppercase text-sm tracking-tight text-left">Government Issued ID - Front</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative bg-slate-50 rounded-2xl w-full sm:w-48 aspect-[3/2] flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                          {uploads.idFront.preview ? (
                            <img src={uploads.idFront.preview} alt="ID Front" className="w-full h-full object-cover" />
                          ) : uploads.idFront.status === 'done' ? (
                             <CheckCircle2 className="h-12 w-12 text-green-500" />
                          ) : (
                            <FileText className="h-12 w-12 text-slate-300" />
                          )}
                          {uploads.idFront.status === 'uploading' && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-accent animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-4 pt-2">
                           <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                            Capture the front face of your current driver's license or identification card. Ensure all four corners are visible.
                          </p>
                          <div className="flex justify-start">
                            {renderUploadButton('idFront', frontInputRef)}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="back" className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white hover:border-accent/20 transition-all">
                    <AccordionTrigger className="hover:no-underline py-2 group">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${uploads.idBack.status === 'done' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-amber-400'}`} />
                        <span className="font-black text-primary uppercase text-sm tracking-tight text-left">Government Issued ID - Back</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative bg-slate-50 rounded-2xl w-full sm:w-48 aspect-[3/2] flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                          {uploads.idBack.preview ? (
                            <img src={uploads.idBack.preview} alt="ID Back" className="w-full h-full object-cover" />
                          ) : uploads.idBack.status === 'done' ? (
                             <CheckCircle2 className="h-12 w-12 text-green-500" />
                          ) : (
                            <FileText className="h-12 w-12 text-slate-300" />
                          )}
                          {uploads.idBack.status === 'uploading' && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-accent animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-4 pt-2">
                          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                            Capture the back of your identification card, focusing on the barcode and legislative markings.
                          </p>
                          <div className="flex justify-start">
                            {renderUploadButton('idBack', backInputRef)}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </CardContent>
            </Card>

            <div className="space-y-6 pt-10">
              <div className="flex flex-col sm:flex-row gap-6 justify-between">
                <Button 
                  variant="outline" 
                  asChild
                  className="border-primary/10 text-slate-400 font-black h-16 px-10 rounded-[1.25rem] flex-1 uppercase tracking-[0.2em] text-[10px] hover:bg-slate-50 hover:text-primary transition-all"
                >
                  <Link href="/provider-signup/details">
                    Go Back To Details
                  </Link>
                </Button>
                <Button 
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-10 rounded-[1.25rem] uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-accent/30 flex-1 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {isLoading ? "Synchronizing..." : "Submit Verification System"}
                  <ArrowRight className="ml-3 h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-center pt-4">
                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">Protected by Wont Stop Moving® Security Tier 1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
