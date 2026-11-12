"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Wallet } from "lucide-react";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { ReferralCard } from "@/components/dashboard/referral-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth, useUser } from "@/firebase";
import { apiFetch } from "@/lib/api-client";
import { LEDGER_REASONS, type LedgerEntry } from "@/lib/rewards";
import { useToast } from "@/hooks/use-toast";

type Wallet = { balance: number; ledger: LedgerEntry[]; moveCreditUsd: number; maxSharePct: number };
const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;

export default function CustomerRewardsPage() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { apiFetch<Wallet>(auth, "/api/rewards/me").then(setWallet).catch(() => setWallet(null)); }, [auth]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const { amount } = await apiFetch<{ amount: number }>(auth, "/api/rewards/redeem", { code });
      toast({ title: `${usd(amount)} added`, description: "Your gift card is now move credit." });
      setCode(""); load();
    } catch (err) { toast({ variant: "destructive", title: "Couldn’t redeem", description: err instanceof Error ? err.message : "" }); }
    finally { setBusy(false); }
  };

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        <h1 className="text-3xl font-black text-primary uppercase tracking-tight">Rewards</h1>
        <Card className="border-none shadow-sm rounded-2xl bg-primary text-white">
          <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/70 flex items-center gap-1"><Wallet className="h-4 w-4" /> Move credit</p>
              <p className="text-5xl font-black">{wallet ? usd(wallet.balance) : "…"}</p>
              <p className="text-sm text-white/80 mt-1">Applied at checkout on your next move, up to {wallet?.maxSharePct ?? 15}% of its price. The rest carries over.</p>
            </div>
            <Button asChild className="bg-accent hover:bg-accent/90 font-black uppercase"><Link href="/quote">Plan a move</Link></Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader><CardTitle className="text-lg">How you earn</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700 space-y-2">
              <p><b>{usd(wallet?.moveCreditUsd ?? 25)} after every completed move.</b> It&apos;s added automatically when your crew finishes.</p>
              <p><b>Gift cards</b> you receive become credit when you redeem them below.</p>
              <p><b>Discounts:</b> students, military and seniors (62+) get 5% off. Choose it when you get your quote.</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-accent" /> Redeem a gift card</CardTitle><CardDescription>Enter the code from your email.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={redeem} className="flex gap-2">
                <Input aria-label="Gift card code" placeholder="WSM-ABCD-EFGH" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={20} />
                <Button type="submit" disabled={busy || code.replace(/[^A-Z0-9]/g, "").length < 8}>{busy ? "…" : "Redeem"}</Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">Want to give one? <Link className="underline" href="/gift-cards">Send a gift card</Link></p>
            </CardContent>
          </Card>
        </div>

        <ReferralCard />

        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader><CardTitle className="text-lg">History</CardTitle></CardHeader>
          <CardContent>
            {!wallet?.ledger.length ? <p className="text-sm text-muted-foreground">No credit activity yet.</p> : (
              <ul className="divide-y text-sm">
                {wallet.ledger.map(e => (
                  <li key={e.id} className="py-2 flex justify-between gap-3">
                    <span>{LEDGER_REASONS[e.reason] || e.reason}<span className="block text-xs text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ""}</span></span>
                    <span className={`font-bold ${e.amount < 0 ? "text-slate-500" : "text-green-700"}`}>{e.amount < 0 ? "−" : "+"}{usd(Math.abs(e.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
