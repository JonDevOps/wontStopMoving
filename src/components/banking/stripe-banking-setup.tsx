"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/firebase";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Copy,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BANK_CHECKLIST = [
  {
    id: "bank_ein",
    title: "1. Have Your IRS EIN Confirmation Letter Ready",
    desc: "Locate your IRS EIN confirmation PDF (Form CP 575). Every business bank and Stripe requires your 9-digit Employer Identification Number (XX-XXXXXXX).",
  },
  {
    id: "bank_formation",
    title: "2. Articles of Incorporation / LLC Formation & Operating Agreement",
    desc: "Have your state-stamped Articles of Incorporation (or Articles of Organization) and Operating Agreement / Bylaws PDF ready to upload.",
  },
  {
    id: "bank_open",
    title: "3. Open Your Business Checking Account",
    desc: "Recommended for logistics & Stripe startups: Mercury (mercury.com — $0 fees, fast online approval, virtual cards), Relay Financial (relayfi.com — great for separating 15% platform revenue vs 85% provider payouts), or Chase Business Complete Banking.",
  },
  {
    id: "bank_routing",
    title: "4. Copy Your Business Routing & Account Numbers",
    desc: "Once approved, download a voided check / bank verification letter and copy your 9-digit ABA Routing Number and Business Checking Account Number for Stripe.",
  },
];

const STRIPE_CHECKLIST = [
  {
    id: "stripe_activate",
    title: "1. Activate Your Stripe Account & Link Your Business Bank Account",
    desc: "Go to dashboard.stripe.com, complete business verification using your EIN and Business Checking Routing/Account numbers so customer payments settle directly into your business bank.",
  },
  {
    id: "stripe_connect",
    title: "2. Enable Stripe Connect (Express Accounts)",
    desc: "In Stripe Dashboard → Connect → Settings, enable Express Accounts. This powers your /api/stripe/account route so Service Providers can link their own bank accounts and receive their 85% payouts.",
  },
  {
    id: "stripe_keys",
    title: "3. Copy Your Secret Key into .env.local & Firebase App Hosting",
    desc: "In Stripe Dashboard → Developers → API Keys, copy your Secret Key (sk_test_... for testing or sk_live_... for live) and paste it as STRIPE_SECRET_KEY in .env.local.",
  },
  {
    id: "stripe_webhook",
    title: "4. Configure Your Stripe Webhook Endpoint",
    desc: "In Stripe Dashboard → Developers → Webhooks, add endpoint https://wontstopmoving.com/api/webhooks/stripe listening to 'checkout.session.completed', and copy the Signing Secret (whsec_...) into STRIPE_WEBHOOK_SECRET.",
  },
];

export function StripeBankingSetup() {
  const auth = useAuth();
  const { toast } = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [stripeConfig, setStripeConfig] = useState<{
    hasRealSecretKey: boolean;
    hasWebhookSecret: boolean;
    mode: string;
    connectionValid: boolean;
    errorMessage: string | null;
  } | null>(null);

  const checkStripeStatus = async () => {
    setStatusLoading(true);
    try {
      setStripeConfig(await apiFetch(auth, "/api/stripe/config-status"));
    } catch {
      setStripeConfig(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    checkStripeStatus();
    const saved = localStorage.getItem("wsm_banking_stripe_checklist");
    if (saved) {
      try {
        setChecked(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("wsm_banking_stripe_checklist", JSON.stringify(next));
      return next;
    });
  };

  const copyEnvSnippet = () => {
    const snippet = `STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE\nSTRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE`;
    navigator.clipboard.writeText(snippet);
    toast({
      title: "Copied .env.local Template",
      description: "Paste your keys into /Users/jonathan/Developer/projects/wontStopMoving/.env.local",
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl overflow-hidden">
        <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Badge className="bg-accent text-white border-none text-[10px] font-black uppercase tracking-widest">
              Financial Infrastructure & Payout Setup
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">
              Business Bank & <span className="text-accent">Stripe Payments</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Step-by-step setup to open your Wont Stop Moving business bank account, connect Stripe Checkout, and automate 85% Service Provider / 15% Platform split payouts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={checkStripeStatus}
              disabled={statusLoading}
              className="border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-900 rounded-xl font-bold uppercase text-xs gap-2 h-12"
            >
              <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
              Test Stripe Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Stripe Codebase Connection Status */}
      <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-gray-100 py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent" />
            Live Stripe Integration Diagnostics
          </CardTitle>
          {stripeConfig?.connectionValid ? (
            <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-black uppercase">
              Connected ({stripeConfig.mode.toUpperCase()} Mode)
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-black uppercase">
              Awaiting API Key in .env.local
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                1. STRIPE_SECRET_KEY
              </p>
              <p className="text-sm font-black text-primary flex items-center gap-2">
                {stripeConfig?.hasRealSecretKey ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Configured ({stripeConfig.mode.toUpperCase()})
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Using Safe Placeholder
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Powers Customer Checkout (`/api/stripe/checkout`) & Provider Onboarding (`/api/stripe/account`).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                2. STRIPE_WEBHOOK_SECRET
              </p>
              <p className="text-sm font-black text-primary flex items-center gap-2">
                {stripeConfig?.hasWebhookSecret ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Webhook Secret Active
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Not Set Yet
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Verifies `/api/webhooks/stripe` events to automatically create jobs after payment.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                3. API Routes Wired in Repo
              </p>
              <p className="text-sm font-black text-green-700 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                5/5 Endpoints Ready
              </p>
              <p className="text-xs text-muted-foreground">
                Checkout, Connect Express Account, Account Link, Account Status, and Webhook routes are all built!
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-accent">
                Where to paste your Stripe keys locally:
              </p>
              <code className="text-xs text-slate-300 font-mono block">
                /Users/jonathan/Developer/projects/wontStopMoving/.env.local
              </code>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={copyEnvSnippet}
              className="bg-accent hover:bg-accent/90 text-white font-black uppercase text-xs rounded-xl gap-2 shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy .env.local Keys Template
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Business Bank Account Checklist */}
        <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary text-white p-6">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5">
              <Landmark className="h-5 w-5 text-accent" />
              Part 1: Business Bank Account Setup
            </CardTitle>
            <p className="text-xs text-white/70">
              Open your business checking account first so Stripe has a verified bank to deposit your revenue.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {BANK_CHECKLIST.map((item) => {
              const isDone = Boolean(checked[item.id]);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isDone
                      ? "bg-green-50/70 border-green-300"
                      : "bg-slate-50/70 border-slate-200/80 hover:border-accent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => toggleCheck(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-5 w-5"
                    />
                    <div className="space-y-1">
                      <p
                        className={`font-black text-sm uppercase tracking-tight ${
                          isDone ? "line-through text-green-800" : "text-primary"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2 flex flex-wrap gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                <a href="https://mercury.com" target="_blank" rel="noreferrer">
                  Mercury Business Banking <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                <a href="https://relayfi.com" target="_blank" rel="noreferrer">
                  Relay Financial <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                <a
                  href="https://www.chase.com/business/banking/checking"
                  target="_blank"
                  rel="noreferrer"
                >
                  Chase Business <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Stripe Payments & Connect Setup Checklist */}
        <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-[#635BFF] text-white p-6">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-white" />
              Part 2: Stripe Payments & Connect Setup
            </CardTitle>
            <p className="text-xs text-white/80">
              Connect your business bank account to Stripe and paste your API keys into `.env.local`.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {STRIPE_CHECKLIST.map((item) => {
              const isDone = Boolean(checked[item.id]);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isDone
                      ? "bg-green-50/70 border-green-300"
                      : "bg-slate-50/70 border-slate-200/80 hover:border-[#635BFF]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => toggleCheck(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-5 w-5"
                    />
                    <div className="space-y-1">
                      <p
                        className={`font-black text-sm uppercase tracking-tight ${
                          isDone ? "line-through text-green-800" : "text-primary"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2 flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                className="bg-[#635BFF] hover:bg-[#4f46e5] text-white rounded-xl font-bold text-xs gap-1.5"
              >
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Stripe API Keys <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                <a
                  href="https://dashboard.stripe.com/connect/accounts/overview"
                  target="_blank"
                  rel="noreferrer"
                >
                  Stripe Connect Settings <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                <a
                  href="https://dashboard.stripe.com/webhooks"
                  target="_blank"
                  rel="noreferrer"
                >
                  Stripe Webhooks <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

