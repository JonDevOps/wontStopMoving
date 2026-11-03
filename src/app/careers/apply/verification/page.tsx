"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Upload,
  ArrowRight,
  CheckCircle2,
  Loader2,
  CreditCard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useUser,
  useStorage,
  useFirestore,
  errorEmitter,
  FirestorePermissionError,
} from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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

export default function EmployeeVerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const storage = useStorage();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(false);
  const [idType, setIdType] = useState<IdDocumentType>("drivers_license");
  const [uploads, setUploads] = useState<
    Record<string, { status: UploadStatus; url?: string }>
  >({
    selfie: { status: "idle" },
    idFront: { status: "idle" },
    idBack: { status: "idle" },
  });

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login?role=employee");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !firestore) return;
    const syncExisting = async () => {
      try {
        const snap = await getDoc(doc(firestore, "employees", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const v = data.verification || {};
          if (v.idType && v.idType in ID_TYPE_LABELS) {
            setIdType(v.idType as IdDocumentType);
          }
          setUploads({
            selfie: { status: v.selfie ? "done" : "idle", url: v.selfie },
            idFront: { status: v.idFront ? "done" : "idle", url: v.idFront },
            idBack: { status: v.idBack ? "done" : "idle", url: v.idBack },
          });
        }
      } catch (e) {
        console.error("Sync error:", e);
      }
    };
    syncExisting();
  }, [user, firestore]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploads((prev) => ({ ...prev, [field]: { status: "uploading" } }));

    try {
      const { uploadVerificationDocument } = await import("@/lib/storage-upload");
      const downloadURL = await uploadVerificationDocument(user.uid, field, file);

      setUploads((prev) => ({
        ...prev,
        [field]: { status: "done", url: downloadURL },
      }));

      const employeeRef = doc(firestore, "employees", user.uid);
      const data = {
        "verification.idType": idType,
        [`verification.${field}`]: downloadURL,
        [`verification.${field}At`]: new Date().toISOString(),
      };

      updateDoc(employeeRef, data).catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: employeeRef.path,
          operation: "update",
          requestResourceData: data,
        });
        errorEmitter.emit("permission-error", permissionError);
      });

      toast({
        title: "Document Uploaded",
        description: `${file.name} has been securely stored for review.`,
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      setUploads((prev) => ({ ...prev, [field]: { status: "error" } }));
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description:
          error.message || "Could not upload document. You can also skip and try later.",
      });
    }
  };

  const handleSkipForLater = () => {
    toast({
      title: "Saved as a Dashboard Task",
      description:
        "You can complete ID Verification and 2FA anytime from your Employee Dashboard.",
    });
    router.push("/dashboard/employee");
  };

  const handleFinish = () => {
    const requiresBack = ID_TYPE_LABELS[idType].requiresBack;
    const isComplete =
      uploads.selfie.status === "done" &&
      uploads.idFront.status === "done" &&
      (!requiresBack || uploads.idBack.status === "done");

    if (!isComplete) {
      toast({
        variant: "destructive",
        title: "Missing Required Document",
        description: requiresBack
          ? "Please upload your Selfie, ID Front, and ID Back — or click 'Skip & Do Later in Dashboard'."
          : "Please upload your Selfie and Passport Photo Page — or click 'Skip & Do Later in Dashboard'.",
      });
      return;
    }

    setIsLoading(true);

    if (user) {
      const employeeRef = doc(firestore, "employees", user.uid);
      const data = {
        "verification.idType": idType,
        onboardingStep: 4,
        status: "applicant",
      };

      updateDoc(employeeRef, data)
        .then(() => {
          toast({
            title: "ID Verification Submitted",
            description: "Redirecting to your Employee Dashboard.",
          });
          router.push("/dashboard/employee");
        })
        .catch(async () => {
          setIsLoading(false);
          const permissionError = new FirestorePermissionError({
            path: employeeRef.path,
            operation: "update",
            requestResourceData: data,
          });
          errorEmitter.emit("permission-error", permissionError);
        });
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-primary font-bold uppercase tracking-widest text-xs">
        Verifying session...
      </div>
    );
  }

  const renderUploadButton = (
    field: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const status = uploads[field]?.status || "idle";

    return (
      <div className="flex flex-col items-end gap-2">
        <input
          type="file"
          hidden
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
          onChange={(e) => handleFileUpload(e, field)}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className={`${
            status === "done"
              ? "bg-green-500 hover:bg-green-600"
              : "bg-accent hover:bg-accent/90"
          } text-white rounded-lg px-8 h-11 gap-2 font-black uppercase text-xs tracking-widest shadow-lg shadow-accent/20`}
        >
          {status === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {status === "uploading"
            ? "Uploading..."
            : status === "done"
            ? "Replace File"
            : "Upload Photo or PDF"}
        </Button>
        {status === "error" && (
          <p className="text-[10px] text-destructive font-bold uppercase">
            Try again
          </p>
        )}
      </div>
    );
  };

  const currentIdConfig = ID_TYPE_LABELS[idType];

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-28 pb-24">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10 space-y-3">
            <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              Optional During Signup • Complete Anytime
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-primary uppercase tracking-tight">
              Employee <span className="text-accent">ID Verification</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed px-4">
              Choose your identification document type below, or skip this step and complete it later from your dashboard tasks.
            </p>
          </div>

          <div className="space-y-6">
            {/* ID Document Type Selector */}
            <Card className="border-none shadow-md bg-white rounded-2xl">
              <CardContent className="p-6 space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-accent" />
                  Select ID Document Type
                </Label>
                <Select
                  value={idType}
                  onValueChange={(val: IdDocumentType) => setIdType(val)}
                >
                  <SelectTrigger className="h-12 rounded-xl font-bold">
                    <SelectValue placeholder="Choose ID type" />
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
                <p className="text-[11px] text-muted-foreground">
                  Accepted formats: JPG, PNG, WEBP, HEIC, or PDF.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none rounded-2xl shadow-xl bg-white overflow-hidden">
              <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-lg font-black text-primary uppercase tracking-tight">
                  Required Uploads ({currentIdConfig.requiresBack ? "3 Items" : "2 Items"})
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipForLater}
                  className="text-xs font-black uppercase tracking-wider text-accent hover:text-accent/80"
                >
                  Skip for Now →
                </Button>
              </div>
              <CardContent className="p-0">
                <Accordion
                  type="multiple"
                  defaultValue={["selfie", "front", "back"]}
                  className="divide-y divide-gray-100"
                >
                  <AccordionItem
                    value="selfie"
                    className="border-none px-6 py-6 group"
                  >
                    <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            uploads.selfie.status === "done"
                              ? "bg-green-500"
                              : "bg-amber-500 animate-pulse"
                          }`}
                        />
                        <span className="font-black text-primary uppercase text-sm tracking-tight">
                          1. Selfie Holding Your ID
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Upload a clear photo of yourself holding your selected ID next to your face in a well-lit area.
                      </p>
                      <div className="flex justify-end pt-2">
                        {renderUploadButton("selfie", selfieInputRef)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="front"
                    className="border-none px-6 py-6 group"
                  >
                    <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            uploads.idFront.status === "done"
                              ? "bg-green-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span className="font-black text-primary uppercase text-sm tracking-tight">
                          2. {currentIdConfig.frontLabel}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Upload a clear photo or PDF scan of the front / main photo page of your ID.
                      </p>
                      <div className="flex justify-end pt-2">
                        {renderUploadButton("idFront", frontInputRef)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {currentIdConfig.requiresBack && (
                    <AccordionItem
                      value="back"
                      className="border-none px-6 py-6 group"
                    >
                      <AccordionTrigger className="hover:no-underline py-0 group-data-[state=open]:pb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              uploads.idBack.status === "done"
                                ? "bg-green-500"
                                : "bg-amber-500"
                            }`}
                          />
                          <span className="font-black text-primary uppercase text-sm tracking-tight">
                            3. Identification Card - Back
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Upload the back of your card showing the barcode or endorsement details.
                        </p>
                        <div className="flex justify-end pt-2">
                          {renderUploadButton("idBack", backInputRef)}
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
                  className="border-primary/20 text-primary font-black h-14 px-8 rounded-xl flex-1 uppercase tracking-widest text-xs hover:bg-primary/5"
                >
                  Skip & Complete Later in Dashboard
                </Button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={isLoading}
                  className="bg-accent hover:bg-accent/90 text-white font-black h-14 px-8 rounded-xl uppercase tracking-widest text-xs shadow-xl shadow-accent/30 flex-1"
                >
                  {isLoading ? "Submitting..." : "Submit ID Verification"}
                </Button>
              </div>
              <div className="flex justify-between items-center pt-2">
                <Button
                  asChild
                  variant="ghost"
                  className="text-muted-foreground font-bold hover:text-primary p-0 h-auto gap-2 uppercase text-[10px] tracking-widest"
                >
                  <Link href="/careers/apply/details">
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    Back to Details
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-accent font-black hover:text-accent/80 p-0 h-auto gap-2 uppercase text-[10px] tracking-widest"
                >
                  <Link href="/dashboard/employee">
                    Go to Employee Dashboard →
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
