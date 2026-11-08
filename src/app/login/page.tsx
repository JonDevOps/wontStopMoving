"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Truck,
  User,
  HardHat,
  Building2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicLayout } from "@/components/layout/public-layout";
import { useAuth, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { GoogleButton } from "@/components/auth/google-button";
import { useMfaSignIn } from '@/components/auth/mfa-provider';
import {
  signInWithGooglePopup,
  getProfileRole,
  createSelfServiceProfile,
  dashboardForRole,
  googleErrorMessage,
  signOutQuietly,
} from "@/lib/google-sign-in";

type PortalRole = "customer" | "provider" | "employee" | "admin";

const PORTAL_CONFIG: Record<
  PortalRole,
  {
    label: string;
    shortLabel: string;
    titlePrefix: string;
    titleAccent: string;
    subtitle: string;
    description: string;
    icon: typeof User;
    signupHref?: string;
    signupLabel: string;
    signupPrompt: string;
    emailPlaceholder: string;
  }
> = {
  customer: {
    label: "Customer",
    shortLabel: "Customer",
    titlePrefix: "Customer",
    titleAccent: "Login",
    subtitle: "Track your move, manage quotes, and book services",
    description:
      "Book a move, manage your quotes, and track your relocation in real time.",
    icon: User,
    signupHref: "/signup",
    signupLabel: "Sign Up as a Customer",
    signupPrompt: "Need to book or track a move?",
    emailPlaceholder: "customer@wontstopmoving.com",
  },
  provider: {
    label: "Service Provider",
    shortLabel: "Provider",
    titlePrefix: "Provider",
    titleAccent: "Login",
    subtitle: "Manage your moving business, marketplace jobs, and payouts",
    description:
      "Partner portal for independent moving companies and contractors on our marketplace.",
    icon: Building2,
    signupHref: "/provider-signup",
    signupLabel: "Sign Up as a Service Provider",
    signupPrompt: "Want to list your moving business on our marketplace?",
    emailPlaceholder: "provider@wontstopmoving.com",
  },
  employee: {
    label: "Employee",
    shortLabel: "Employee",
    titlePrefix: "Employee",
    titleAccent: "Login",
    subtitle: "Access dispatch schedules, assigned jobs, and team tools",
    description:
      "Sign in to view your dispatch schedule, active crew jobs, and onboarding status.",
    icon: HardHat,
    signupHref: "/careers/apply",
    signupLabel: "Sign Up as an Employee",
    signupPrompt: "Joining the Wont Stop Moving crew?",
    emailPlaceholder: "employee@wontstopmoving.com",
  },
  admin: {
    label: "Admin",
    shortLabel: "Admin",
    titlePrefix: "Admin",
    titleAccent: "Sign In",
    subtitle: "Executive & dispatch administration",
    description: "Executive & dispatch administration",
    icon: ShieldCheck,
    signupLabel: "Admin accounts are added by an existing admin",
    signupPrompt: "Need admin access?",
    emailPlaceholder: "admin@wontstopmoving.com",
  },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  const completeSignIn = useMfaSignIn();
  const firestore = useFirestore();

  const roleParam = searchParams.get("role") as PortalRole | null;
  const redirectParam = searchParams.get("redirect");

  const [selectedRole, setSelectedRole] = useState<PortalRole | null>(
    roleParam && roleParam in PORTAL_CONFIG ? roleParam : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (roleParam && roleParam in PORTAL_CONFIG) {
      setSelectedRole(roleParam);
    } else if (!roleParam) {
      setSelectedRole(null);
    }
  }, [roleParam]);

  const handleSelectRole = (role: PortalRole) => {
    setSelectedRole(role);
    const params = new URLSearchParams(searchParams.toString());
    params.set("role", role);
    params.delete("mode");
    router.replace(`/login?${params.toString()}`, { scroll: false });
  };

  const handleClearRole = () => {
    setSelectedRole(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("role");
    params.delete("mode");
    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login", { scroll: false });
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithGooglePopup(auth, completeSignIn);
      let role = await getProfileRole(firestore, user.uid);

      if (!role) {
        // First Google sign-in: customers and providers can create their own
        // account here. Employees apply through careers; admins are added by
        // an existing admin.
        if (selectedRole === "employee" || selectedRole === "admin") {
          await signOutQuietly(auth);
          toast({
            variant: "destructive",
            title: "No account found",
            description:
              selectedRole === "admin"
                ? "Admin accounts are added by an existing admin."
                : "Apply on the Careers page to create an employee account.",
          });
          return;
        }
        role = selectedRole === "provider" ? "provider" : "customer";
        await createSelfServiceProfile(firestore, user, { role: role as "customer" | "provider" });
        toast({
          title: "Account created",
          description:
            role === "provider"
              ? "Your provider account is pending admin approval."
              : "Welcome to Wont Stop Moving!",
        });
      }

      router.push(redirectParam || dashboardForRole(role));
    } catch (error: unknown) {
      const message = googleErrorMessage(error);
      if (message) {
        toast({ variant: "destructive", title: "Google Sign-In Failed", description: message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await completeSignIn(() => signInWithEmailAndPassword(
        auth,
        email,
        password
      ));
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

      if (redirectParam) {
        router.push(redirectParam);
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;

      if (role === "admin") router.push("/dashboard/admin");
      else if (role === "employee") router.push("/dashboard/employee");
      else if (role === "provider") router.push("/dashboard/provider");
      else router.push("/dashboard/customer");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error?.code === 'auth/mfa-cancelled' ? 'Verification cancelled. Please try signing in again.' : "Unable to sign in. Check your credentials and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Role Selection Screen (Customer, Employee, Service Provider, or Admin)
  if (!selectedRole) {
    return (
      <div className="w-full max-w-6xl relative z-10 my-12">
        <div className="text-center mb-10 space-y-3">
          <div className="mx-auto bg-primary text-white p-3.5 rounded-2xl w-fit shadow-lg shadow-primary/20">
            <Truck className="h-8 w-8" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">
            Choose Your <span className="text-accent">Portal</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto font-medium">
            Select how you use Wont Stop Moving to sign in or create a new account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(PORTAL_CONFIG) as PortalRole[]).map((roleKey) => {
            const portal = PORTAL_CONFIG[roleKey];
            const Icon = portal.icon;
            return (
              <Card
                key={roleKey}
                className="border-2 border-transparent hover:border-accent/40 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white rounded-3xl overflow-hidden flex flex-col justify-between group"
              >
                <CardContent className="p-7 flex flex-col h-full justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="bg-primary/5 group-hover:bg-accent group-hover:text-white text-primary p-4 rounded-2xl w-fit transition-colors">
                      <Icon className="h-8 w-8" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                        {portal.label} Portal
                      </span>
                      <h2 className="text-2xl font-black text-primary uppercase tracking-tight mt-1">
                        {portal.label}
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {portal.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <Button
                      type="button"
                      onClick={() => handleSelectRole(roleKey)}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl uppercase tracking-wider text-xs gap-2"
                    >
                      {portal.shortLabel} Sign In
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    {portal.signupHref ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-12 border-gray-200 hover:border-accent hover:text-accent rounded-xl font-bold uppercase tracking-wider text-xs gap-2"
                      >
                        <Link href={portal.signupHref}>
                          <UserPlus className="h-4 w-4" />
                          {portal.shortLabel} Sign Up
                        </Link>
                      </Button>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground py-3">
                        Admin accounts are added by an existing admin.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Step 2: Role-Specific Login + Role-Specific Signup CTA
  const activePortal = PORTAL_CONFIG[selectedRole];
  const ActiveIcon = activePortal.icon;

  return (
    <Card className="w-full max-w-md border-none shadow-2xl relative z-10 bg-white my-12 rounded-3xl overflow-hidden">
      {/* Quick Role Switcher Tabs */}
      <div className="bg-gray-100/80 p-2 border-b border-gray-200/60">
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(PORTAL_CONFIG) as PortalRole[]).map((roleKey) => {
            const isSelected = selectedRole === roleKey;
            return (
              <button
                key={roleKey}
                type="button"
                onClick={() => handleSelectRole(roleKey)}
                className={`py-2.5 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  isSelected
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-primary hover:bg-white/60"
                }`}
              >
                {PORTAL_CONFIG[roleKey].shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <CardHeader className="space-y-4 text-center pt-8 pb-2 px-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClearRole}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Portals
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded-full">
            {activePortal.label}
          </span>
        </div>

        <div className="mx-auto bg-primary text-white p-3.5 rounded-2xl w-fit shadow-lg shadow-primary/20">
          <ActiveIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">
            {activePortal.titlePrefix}{" "}
            <span className="text-accent">{activePortal.titleAccent}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activePortal.subtitle}
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
          {searchParams.get('security') === 'updated' && <p role="status" className="text-sm rounded-lg bg-green-50 p-3 text-green-900">Your security settings were updated. Sign in again to continue.</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder={activePortal.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-gray-200"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-accent font-bold hover:underline"
                >
                  Forgot?
                </Link>
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
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-base uppercase tracking-wider"
            >
              {isLoading
                ? "Signing In..."
                : `Sign In as ${activePortal.shortLabel}`}
            </Button>
          </form>

        <GoogleButton onClick={handleGoogleLogin} disabled={isLoading} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-muted-foreground font-bold">
              {activePortal.signupPrompt}
            </span>
          </div>
        </div>

        {activePortal.signupHref ? (
          <Button
            asChild
            variant="outline"
            className="w-full h-12 border-2 border-accent/30 hover:border-accent hover:bg-accent/5 rounded-xl gap-2 text-primary font-black uppercase tracking-wider text-xs"
          >
            <Link href={activePortal.signupHref}>
              <UserPlus className="h-4 w-4 text-accent" />
              {activePortal.signupLabel}
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-center text-muted-foreground">
            Admin accounts are added by an existing admin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden px-4 pt-24 pb-12">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-accent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <Suspense
          fallback={
            <div className="py-20 font-black text-primary uppercase tracking-tighter animate-pulse">
              Loading Portal...
            </div>
          }
        >
          <LoginContent />
        </Suspense>
      </div>
    </PublicLayout>
  );
}
