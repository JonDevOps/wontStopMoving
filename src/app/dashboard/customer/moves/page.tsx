
"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, useMemoFirebase, useUser, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Truck, Calendar, MapPin, Package, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useEffect, Suspense } from "react";
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

function MovesContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Query for user's active and past jobs
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [firestore, user]);

  const { data: jobs, isLoading } = useCollection(jobsQuery);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = searchParams.get("session_id");
  const jobId = searchParams.get("job_id");
  const demoQuoteId = searchParams.get("demo_quote_id");
  const demoAmount = searchParams.get("amount");

  useEffect(() => {
    if (sessionId && jobId && firestore) {
      const verifySession = async () => {
        try {
          const res = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId })
          });
          const data = await res.json();
          if (data.paymentStatus === "paid") {
            const jobRef = doc(firestore, "jobs", jobId);
            await updateDoc(jobRef, { 
              status: "confirmed",
              paymentIntentId: data.paymentIntentId || null,
              stripeCustomerId: data.customerId || null
            });
            toast({
              title: data.demo ? "Demo Booking Confirmed! 🎉" : "Payment Successful! 🎉",
              description: data.demo
                ? "Your moving job has been confirmed in sandbox mode (add your live Stripe key in Banking & Stripe Setup when ready)."
                : "Your moving job has been fully confirmed and is held in escrow.",
            });
            router.replace("/dashboard/customer/moves", { scroll: false });
          }
        } catch (error) {
          console.error("Session verification failed", error);
        }
      };
      verifySession();
    } else if (sessionId && !jobId && firestore && user) {
      const verifyQuoteSession = async () => {
        try {
          const res = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const data = await res.json();
          const quoteId = data.metadata?.quoteId;
          if (data.paymentStatus === "paid" && quoteId) {
            const quoteRef = doc(firestore, "quotes", quoteId);
            const quoteSnap = await getDoc(quoteRef);
            const quoteData = quoteSnap.exists() ? quoteSnap.data() : {};
            let details: any = {};
            try {
              details = typeof quoteData.details === "string" ? JSON.parse(quoteData.details) : quoteData.details || {};
            } catch {}

            const deterministicJobId = `job_quote_${quoteId}`;
            const newJobRef = doc(firestore, "jobs", deterministicJobId);
            const existingSnap = await getDoc(newJobRef);
            const releaseCode =
              existingSnap.exists() && existingSnap.data()?.releaseCode
                ? existingSnap.data().releaseCode
                : Math.floor(100000 + Math.random() * 900000).toString();

            await setDoc(
              newJobRef,
              {
                id: deterministicJobId,
                customerId: user.uid,
                quoteId,
                status: "confirmed",
                state: quoteData.state || details.state || "California",
                moveDate: quoteData.moveDate || details.moveDate || new Date().toISOString().split("T")[0],
                pickupAddress: quoteData.pickupZip || details.pickupZip || "Local Pickup",
                dropoffAddress: quoteData.dropoffZip || details.dropoffZip || "Local Drop-off",
                moveSize: data.metadata?.moveSize || quoteData.moveSize || details.moveSize || "studio",
                price: data.amountTotal || quoteData.estimatedTotal || 550,
                employeeIds: [],
                providerIds: quoteData.preferredProviderId ? [quoteData.preferredProviderId] : [],
                releaseCode,
                stripeCustomerId: data.customerId || null,
                paymentIntentId: data.paymentIntentId || null,
                paymentId: sessionId,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );

            try {
              await updateDoc(quoteRef, { status: "processed" });
            } catch {}

            toast({
              title: "Payment Successful & Move Confirmed! 🎉",
              description: `Your move is confirmed in escrow. Your 6-digit release code is ${releaseCode}.`,
            });
            router.replace("/dashboard/customer/moves", { scroll: false });
          }
        } catch (err) {
          console.error("Quote session verification failed", err);
        }
      };
      verifyQuoteSession();
    } else if (demoQuoteId && firestore && user) {
      const createDemoJobFromQuote = async () => {
        try {
          const quoteRef = doc(firestore, "quotes", demoQuoteId);
          const quoteSnap = await getDoc(quoteRef);
          const quoteData = quoteSnap.exists() ? quoteSnap.data() : {};
          let details: any = {};
          try {
            details = typeof quoteData.details === "string" ? JSON.parse(quoteData.details) : quoteData.details || {};
          } catch {}

          const newJobRef = doc(collection(firestore, "jobs"));
          const releaseCode = Math.floor(100000 + Math.random() * 900000).toString();
          await setDoc(newJobRef, {
            id: newJobRef.id,
            customerId: user.uid,
            quoteId: demoQuoteId,
            status: "confirmed",
            state: quoteData.state || details.state || "California",
            moveDate: quoteData.moveDate || details.moveDate || new Date().toISOString().split("T")[0],
            pickupAddress: quoteData.pickupZip || details.pickupZip || "Local Pickup",
            dropoffAddress: quoteData.dropoffZip || details.dropoffZip || "Local Drop-off",
            moveSize: quoteData.moveSize || details.moveSize || "studio",
            price: Number(demoAmount) || quoteData.estimatedTotal || 550,
            employeeIds: [],
            providerIds: quoteData.preferredProviderId ? [quoteData.preferredProviderId] : [],
            releaseCode,
            stripeCustomerId: `cus_demo_${Date.now()}`,
            paymentIntentId: `pi_demo_${Date.now()}`,
            createdAt: serverTimestamp(),
          });

          try {
            await updateDoc(quoteRef, { status: "processed" });
          } catch {}

          toast({
            title: "Move Booked (Sandbox Mode)! 🎉",
            description: "Your quote has been converted into a confirmed move with a 6-digit escrow release code.",
          });
          router.replace("/dashboard/customer/moves", { scroll: false });
        } catch (err) {
          console.error("Demo quote booking failed", err);
        }
      };
      createDemoJobFromQuote();
    }
  }, [sessionId, jobId, demoQuoteId, demoAmount, firestore, user, router, toast]);

  return (
    <div className="space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">My <span className="text-accent">Moves</span></h1>
            <p className="text-muted-foreground">Track and manage your scheduled relocations</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-accent hover:bg-accent/90 rounded-full font-bold px-8 h-12">
              <Link href="/book">Book a Move</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-accent text-accent hover:bg-accent hover:text-white font-bold px-8 h-12">
              <Link href="/quote">Request Quote</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="p-20 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-xs">
              Retrieving move history...
            </div>
          ) : jobs && jobs.length > 0 ? (
            jobs.map((job) => (
              <Card key={job.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-accent uppercase tracking-widest">Job ID: {job.id}</p>
                          <h3 className="text-xl font-bold text-primary">
                            {job.pickupAddress?.split(',')[0]} to {job.dropoffAddress?.split(',')[0]}
                          </h3>
                        </div>
                        <Badge 
                          className={
                            job.status === 'completed' ? "bg-green-500 hover:bg-green-500" :
                            job.status === 'in-progress' ? "bg-blue-500 hover:bg-blue-500" :
                            "bg-primary hover:bg-primary text-white"
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg text-primary"><Calendar className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Date</p>
                            <p className="text-sm font-bold">
                              {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "TBD"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg text-primary"><Package className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Size</p>
                            <p className="text-sm font-bold capitalize">{job.moveSize}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg text-primary"><MapPin className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Region</p>
                            <p className="text-sm font-bold">{job.state}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l">
                      <Button asChild variant="outline" className="rounded-full font-bold border-primary text-primary hover:bg-primary hover:text-white transition-all gap-2">
                        <Link href={`/dashboard/customer/moves/${job.id}`}>
                          View Details <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-white">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-primary uppercase">No Moves Found</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
                You haven't booked any moves with us yet. Start your journey by requesting a free quote.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 rounded-full px-8 h-12 font-bold">
                <Link href="/book">Book a Move Now</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
  );
}

export default function MyMovesPage() {
  return (
    <CustomerLayout>
      <Suspense fallback={<div className="p-20 text-center animate-pulse uppercase font-bold tracking-widest text-xs text-muted-foreground">Loading dashboard...</div>}>
        <MovesContent />
      </Suspense>
    </CustomerLayout>
  );
}
