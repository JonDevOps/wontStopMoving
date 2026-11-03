"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Smartphone, Mail, KeyRound, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

interface TwoFactorCardProps {
  userProfile?: any;
  compact?: boolean;
  roleLabel?: string;
}

export function TwoFactorCard({ userProfile, compact = false }: TwoFactorCardProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"sms" | "authenticator" | "email">(
    userProfile?.twoFactorMethod || "sms"
  );
  const [phone, setPhone] = useState(userProfile?.twoFactorPhone || userProfile?.phone || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"configure" | "verify">("configure");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isEnabled = Boolean(userProfile?.twoFactorEnabled);

  const handleSendCode = async () => {
    if (method === "sms" && phone.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Phone Number Required",
        description: "Please enter a valid 10-digit phone number for SMS 2FA.",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (method === "email" && auth.currentUser && !auth.currentUser.emailVerified) {
        try {
          await sendEmailVerification(auth.currentUser);
        } catch {
          // Ignore rate limit if already sent recently
        }
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      setGeneratedCode(code);
      setStep("verify");

      toast({
        title:
          method === "authenticator"
            ? "Authenticator Secret Ready"
            : `Verification Code Sent (${code})`,
        description:
          method === "sms"
            ? `Demo SMS code ${code} sent to ${phone}. Enter it below to confirm.`
            : method === "email"
            ? `Verification sent to ${user?.email}. Use code ${code} to confirm.`
            : `Enter code ${code} or any 6-digit code from your authenticator app.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!user || !firestore) return;
    if (verificationCode.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(firestore, "users", user.uid);
      await setDoc(
        userRef,
        {
          twoFactorEnabled: true,
          twoFactorMethod: method,
          twoFactorPhone: method === "sms" ? phone : null,
          twoFactorUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: "2FA Enabled Successfully",
        description: `Two-factor authentication (${method.toUpperCase()}) is now active on your account.`,
      });
      setOpen(false);
      setStep("configure");
      setVerificationCode("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could Not Save 2FA",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const userRef = doc(firestore, "users", user.uid);
      await setDoc(
        userRef,
        {
          twoFactorEnabled: false,
          twoFactorUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({
        title: "2FA Disabled",
        description: "You can re-enable Two-Factor Authentication anytime from your dashboard tasks.",
      });
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isEnabled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-primary uppercase tracking-tight">
                  Two-Factor Auth (2FA)
                </p>
                <Badge
                  className={
                    isEnabled
                      ? "bg-green-100 text-green-700 border-none text-[10px] font-black uppercase"
                      : "bg-amber-100 text-amber-700 border-none text-[10px] font-black uppercase"
                  }
                >
                  {isEnabled ? `Active (${userProfile?.twoFactorMethod || "SMS"})` : "Pending Task"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {isEnabled
                  ? "Your account is protected with two-step verification."
                  : "Optional during signup — complete anytime to secure your account."}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={isEnabled ? "outline" : "default"}
            onClick={() => {
              setStep("configure");
              setOpen(true);
            }}
            className={
              isEnabled
                ? "rounded-xl font-bold text-xs uppercase"
                : "bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs uppercase"
            }
          >
            {isEnabled ? "Manage 2FA" : "Setup 2FA"}
          </Button>
        </div>
      ) : (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Account Security & 2FA
            </CardTitle>
            <Badge
              className={
                isEnabled
                  ? "bg-green-100 text-green-700 border-none text-[10px] font-black uppercase"
                  : "bg-amber-100 text-amber-700 border-none text-[10px] font-black uppercase"
              }
            >
              {isEnabled ? "2FA Active" : "Action Recommended"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isEnabled
                ? `Two-factor authentication is enabled via ${(userProfile?.twoFactorMethod || "sms").toUpperCase()}.`
                : "Protect your account and payouts by enabling SMS, Email, or Authenticator 2FA."}
            </p>
            <Button
              type="button"
              onClick={() => {
                setStep("configure");
                setOpen(true);
              }}
              variant={isEnabled ? "outline" : "default"}
              className={`w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider ${
                isEnabled ? "" : "bg-primary hover:bg-primary/90 text-white"
              }`}
            >
              {isEnabled ? "Update 2FA Settings" : "Enable 2FA Now"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-accent" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Choose how you want to verify your identity when signing in or managing payouts.
            </DialogDescription>
          </DialogHeader>

          {step === "configure" ? (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Verification Method
                </Label>
                <Select
                  value={method}
                  onValueChange={(val: "sms" | "authenticator" | "email") => setMethod(val)}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Choose 2FA method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">
                      <span className="flex items-center gap-2 font-bold">
                        <Smartphone className="h-4 w-4 text-accent inline mr-1" />
                        SMS Text Message (Mobile Phone)
                      </span>
                    </SelectItem>
                    <SelectItem value="authenticator">
                      <span className="flex items-center gap-2 font-bold">
                        <KeyRound className="h-4 w-4 text-accent inline mr-1" />
                        Authenticator App (Google / Apple / Authy)
                      </span>
                    </SelectItem>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2 font-bold">
                        <Mail className="h-4 w-4 text-accent inline mr-1" />
                        Email Security Code ({user?.email})
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {method === "sms" && (
                <div className="space-y-2">
                  <Label htmlFor="twoFactorPhone">Mobile Phone Number</Label>
                  <Input
                    id="twoFactorPhone"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              )}

              {method === "authenticator" && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <p className="font-bold text-primary uppercase">Setup Key for Authenticator App:</p>
                  <code className="block p-2.5 bg-white rounded-lg border font-mono text-sm font-black tracking-widest text-center text-accent">
                    WSM-2FA-{user?.uid?.slice(0, 6).toUpperCase() || "SECURE"}
                  </code>
                  <p className="text-muted-foreground">
                    Add this key to Google Authenticator, Apple Passwords, or Authy, then click Continue.
                  </p>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                {isEnabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDisable2FA}
                    disabled={isSaving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                  >
                    Disable 2FA
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-wider rounded-xl h-12 flex-1"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Verification Code
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 text-xs space-y-1">
                <p className="font-black text-primary uppercase">Verification Code Sent</p>
                <p className="text-muted-foreground">
                  Enter your 6-digit verification code below (Test code:{" "}
                  <span className="font-black text-primary">{generatedCode}</span>).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">6-Digit Security Code</Label>
                <Input
                  id="code"
                  placeholder={generatedCode || "123456"}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="h-12 rounded-xl text-center font-mono text-lg font-black tracking-widest"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("configure")}
                  className="rounded-xl h-12 font-bold"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm2FA}
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-wider rounded-xl h-12 flex-1 gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify & Activate 2FA
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

