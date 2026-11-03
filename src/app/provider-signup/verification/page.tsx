"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  ArrowRight,
  CheckCircle2,
  Loader2,
  FileText,
  Camera,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PublicLayout } from "@/components/layout/public-layout";

type UploadStatus = "idle" | "uploading" | "done" | "error";
type IdDocumentType =
  | "drivers_license"
  | "state_id"
  | "passport"
  | "military_cdl";

const ID_TYPE_LABELS: Record<
  IdDocumentType,
  { label: string; requiresBack: boolean; frontLabel: string }
> = {
  drivers_license: {
    label: "Driver's License (Front & Back)",
    requiresBack: true,
    frontLabel: "Driver's License - Front",
  },
  state_id: {
    label: "State Identification Card (Front & Back)",
    requiresBack: true,
    frontLabel: "State ID Card - Front",
  },
  passport: {
    label: "Passport / Passport Book (Photo Page Only)",
    requiresBack: false,
    frontLabel: "Passport Photo Page",
  },
  military_cdl: {
    label: "Military ID / Commercial CDL (Front & Back)",
    requiresBack: true,
    frontLabel: "Military ID / CDL - Front",
  },
};

export default function ProviderVerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [isLoading, setIsLoading] = useState(false);
  const [idType, setIdType] = useState<IdDocumentType>("drivers_license");
  const [uploads, setUploads] = useState<
    Record<string, { status: UploadStatus; preview?: string }>
  >({
    selfie: { status: "idle" },
    idFront: { status: "idle" },
    idBack: { status: "idle" },
  });

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !firestore) return;

    const syncStatus = async () => {
      try {
        const providerRef = doc(firestore, "providers", user.uid);
        const snap = await getDoc(providerRef);
        if (snap.exists()) {
          const data = snap.data();
          const onboarding = data.onboarding || {};
          if (onboarding.idType && onboarding.idType in ID_TYPE_LABELS) {
            setIdType(onboarding.idType as IdDocumentType);
          }
          setUploads({
            selfie: { status: onboarding.selfieUploaded ? "done" : "idle" },
            idFront: { status: onboarding.idFrontUploaded ? "done" : "idle" },
            idBack: { status: onboarding.idBackUploaded ? "done" : "idle" },
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
      router.replace("/login?role=provider");
    }
  }, [user, isUserLoading, router]);

  const handleFileUpload = async (field: string, file: File) => {
    if (!user || !file || !firestore) return;

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setUploads((prev) => ({
      ...prev,
      [field]: { status: "uploading", preview: previewUrl },
    }));

    try {
      const { uploadVerificationDocument } = await import("@/lib/storage-upload");
      const downloadURL = await uploadVerificationDocument(user.uid, field, file);
      const storagePath = `verifications/${user.uid}/${field}_${Date.now()}_${file.name}`;

      const providerRef = doc(firestore, "providers", user.uid);
      const data = {
        "onboarding.idType": idType,
        [`onboarding.${field}Url`]: downloadURL,
        [`onboarding.${field}Path`]: storagePath,
        [`onboarding.${field}Uploaded`]: true,
        [`onboarding.${field}At`]: new Date().toISOString(),
      };

      await updateDoc(providerRef, data);

      setUploads((prev) => ({
        ...prev,
        [field]: { status: "done", preview: previewUrl },
      }));
      toast({
        title: "Document Secured",
        description: "Your document has been safely uploaded to our encrypted vault.",
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      setUploads((prev) => ({ ...prev, [field]: { status: "error" } }));
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description:
          error.message || "We couldn't process your file. You can skip for now and upload from your dashboard.",
      });
    }
  };

  const handleSkipForLater = () => {
    toast({
      title: "Saved as a Dashboard Task",
      description:
        "You can complete ID Verification, 2FA, and Stripe setup anytime from your Provider Dashboard.",
    });
    router.push("/dashboard/provider");
  };

  const handleFinish = async () => {
    const requiresBack = ID_TYPE_LABELS[idType].requiresBack;
    const allDone =
      uploads.selfie.status === "done" &&
      uploads.idFront.status === "done" &&
      (!requiresBack || uploads.idBack.status === "done");

    if (!allDone) {
      toast({
        variant: "destructive",
        title: "Missing Required Document",
        description: requiresBack
          ? "Please upload all 3 verification documents — or click 'Skip & Do Later in Dashboard'."
          : "Please upload your Selfie and Passport Photo Page — or click 'Skip & Do Later in Dashboard'.",
      });
      return;
    }

    setIsLoading(true);

    if (user) {
      try {
        const providerRef = doc(firestore, "providers", user.uid);
        await updateDoc(providerRef, {
          "onboarding.idType": idType,
          onboardingStep: 4,
          status: "pending",
        });

        toast({
          title: "Verification Submitted",
          description: "Redirecting to your Provider Dashboard.",
        });
        router.push("/dashboard/provider");
      } catch {
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
        <p className="mt-4 text-primary font-black uppercase tracking-widest text-xs">
          Synchronizing Identity...
        </p>
      </div>
    );
  }

  const renderUploadButton = (
    field: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const status = uploads[field]?.status || "idle";

    return (
      <div className="flex flex-col items-start gap-2">
        <input
          type="file"
          hidden
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(field, file);
          }}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className={`${
            status === "done"
              ? "bg-green-500 hover:bg-green-600"
              : "bg-accent hover:bg-accent/90"
          } text-white rounded-[1rem] px-8 h-12 gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-accent/20 transition-all active:scale-95`}
        >
          {status === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {status === "uploading"
            ? "Encrypting..."
            : status === "done"
            ? "Replace Document"
            : "Select Photo or PDF"}
        </Button>
      </div>
    );
  };

  const currentIdConfig = ID_TYPE_LABELS[idType];

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24 relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <div className="text-center mb-10 px-4">
            <div className="mx-auto bg-amber-500/10 text-amber-600 p-4 rounded-3xl w-fit mb-4">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
              Optional During Signup • Complete Anytime in Dashboard
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-primary uppercase tracking-tighter mb-3">
              Identity <span className="text-accent">Verification</span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto font-medium">
              Select your identification document type below, or skip for now and finish verification later as a task inside your Provider Dashboard.
            </p>
          </div>

          <div className="space-y-6">
            {/* ID Document Type Selector */}
            <Card className="border-none shadow-lg rounded-3xl bg-white">
              <CardContent className="p-6 sm:p-8 space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-accent" />
                  Select Identification Type
                </Label>
                <Select
                  value={idType}
                  onValueChange={(val: IdDocumentType) => setIdType(val)}
                >
                  <SelectTrigger className="h-14 rounded-2xl font-bold">
                    <SelectValue placeholder="Choose ID document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ID_TYPE_LABELS) as IdDocumentType[]).map(
                      (key) => (
                        <SelectItem key={key} value={key} className="font-bold">
                          {ID_TYPE_LABELS[key].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, WEBP, HEIC photos, or PDF scans.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-black text-primary uppercase tracking-tighter flex items-center gap-3">
                  <FileText className="h-6 w-6 text-accent" /> Security Protocol
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipForLater}
                  className="text-xs font-black uppercase tracking-wider text-accent hover:text-accent/80"
                >
                  Skip & Do Later →
                </Button>
              </div>
              <CardContent className="p-4 sm:p-8">
                <Accordion
                  type="multiple"
                  defaultValue={["selfie", "front", "back"]}
                  className="space-y-4"
                >
                  <AccordionItem
                    value="selfie"
                    className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white"
                  >
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            uploads.selfie.status === "done"
                              ? "bg-green-500"
                              : "bg-amber-400"
                          }`}
                        />
                        <span className="font-black text-primary uppercase text-sm tracking-tight text-left">
                          1. Live Identity Match (Selfie Holding ID)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative bg-slate-50 rounded-2xl w-full sm:w-44 aspect-square flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                          {uploads.selfie.preview ? (
                            <img
                              src={uploads.selfie.preview}
                              alt="Selfie"
                              className="w-full h-full object-cover"
                            />
                          ) : uploads.selfie.status === "done" ? (
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                          ) : (
                            <Camera className="h-12 w-12 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 space-y-4 pt-2">
                          <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Upload a clear photo of yourself holding your selected ID next to your face.
                          </p>
                          {renderUploadButton("selfie", selfieInputRef)}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="front"
                    className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white"
                  >
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            uploads.idFront.status === "done"
                              ? "bg-green-500"
                              : "bg-amber-400"
                          }`}
                        />
                        <span className="font-black text-primary uppercase text-sm tracking-tight text-left">
                          2. {currentIdConfig.frontLabel}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-4 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="relative bg-slate-50 rounded-2xl w-full sm:w-44 aspect-[3/2] flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                          {uploads.idFront.preview ? (
                            <img
                              src={uploads.idFront.preview}
                              alt="ID Front"
                              className="w-full h-full object-cover"
                            />
                          ) : uploads.idFront.status === "done" ? (
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                          ) : (
                            <FileText className="h-12 w-12 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 space-y-4 pt-2">
                          <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Upload the front or photo page of your selected identification document.
                          </p>
                          {renderUploadButton("idFront", frontInputRef)}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {currentIdConfig.requiresBack && (
                    <AccordionItem
                      value="back"
                      className="border border-slate-100 rounded-[1.5rem] px-6 py-4 bg-white"
                    >
                      <AccordionTrigger className="hover:no-underline py-2">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              uploads.idBack.status === "done"
                                ? "bg-green-500"
                                : "bg-amber-400"
                            }`}
                          />
                          <span className="font-black text-primary uppercase text-sm tracking-tight text-left">
                            3. Government Issued ID - Back
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-4 space-y-6">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                          <div className="relative bg-slate-50 rounded-2xl w-full sm:w-44 aspect-[3/2] flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                            {uploads.idBack.preview ? (
                              <img
                                src={uploads.idBack.preview}
                                alt="ID Back"
                                className="w-full h-full object-cover"
                              />
                            ) : uploads.idBack.status === "done" ? (
                              <CheckCircle2 className="h-12 w-12 text-green-500" />
                            ) : (
                              <FileText className="h-12 w-12 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-4 pt-2">
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                              Upload the back of your identification card showing the barcode.
                            </p>
                            {renderUploadButton("idBack", backInputRef)}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>

            <div className="space-y-4 pt-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipForLater}
                  className="border-primary/20 text-primary font-black h-16 px-8 rounded-2xl flex-1 uppercase tracking-widest text-xs hover:bg-primary/5"
                >
                  Skip & Complete Later in Dashboard
                </Button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-8 rounded-2xl uppercase tracking-widest text-xs shadow-2xl shadow-accent/30 flex-1"
                >
                  {isLoading ? "Synchronizing..." : "Submit Verification"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between items-center pt-2 px-2">
                <Link
                  href="/provider-signup/details"
                  className="text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-wider"
                >
                  ← Back to Details
                </Link>
                <Link
                  href="/dashboard/provider"
                  className="text-xs font-black text-accent hover:underline uppercase tracking-wider"
                >
                  Go to Provider Dashboard →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
