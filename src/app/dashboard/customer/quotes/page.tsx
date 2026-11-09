"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, useCollection, useMemoFirebase, useUser, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { FileText, Calendar, Clock, ChevronRight, Sparkles, MapPin, CreditCard, GraduationCap, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { calculateMoveTotal } from "@/lib/pricing";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { TermsConfirmation } from '@/components/legal/terms-confirmation';
import { TERMS_VERSION } from '@/lib/terms';

export default function MyQuotesPage() {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [payingQuoteId, setPayingQuoteId] = useState<string | null>(null);
  const [checkoutQuoteId, setCheckoutQuoteId] = useState<string | null>(null);

  const handlePayQuote = async (quoteId: string) => {
    setPayingQuoteId(quoteId);
    try {
      // The server reads your quote and calculates the total.
      const { url } = await apiFetch<{ url: string }>(auth, "/api/stripe/quote-checkout", { quoteId, termsAccepted: true, termsVersion: TERMS_VERSION });
      window.location.href = url;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setPayingQuoteId(null);
    }
  };
  const firestore = useFirestore();
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // Query for all quotes requested by the current user
  const quotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "quotes"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [firestore, user]);

  const { data: quotes, isLoading } = useCollection(quotesQuery);

  return (
    <CustomerLayout>
      <div className="space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">My <span className="text-accent">Quotes</span></h1>
            <p className="text-muted-foreground">History of your moving estimates and service requests</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-accent hover:bg-accent/90 rounded-full font-bold px-8 h-12 shadow-lg shadow-accent/20">
              <Link href="/book">Book a Move</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-accent text-accent hover:bg-accent hover:text-white font-bold px-8 h-12">
              <Link href="/quote">Request New Quote</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="p-20 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-xs">
              Retrieving estimate history...
            </div>
          ) : quotes && quotes.length > 0 ? (
            quotes.map((quote) => {
              // Safely parse details if it's stored as a string
              let details: any = {};
              try {
                details = typeof quote.details === 'string' ? JSON.parse(quote.details) : quote.details;
              } catch (e) {
                console.error("Error parsing quote details", e);
              }

              const selectedAddOns = Object.entries(details?.addOns || {})
                .filter(([_, active]) => active)
                .map(([key]) => key);

              const estimatedTotal = calculateMoveTotal(quote.moveSize || details?.moveSize || "studio", selectedAddOns, {
                isStudent: !!details?.isStudent,
                isMilitary: !!details?.isMilitary,
                isExpress: !!details?.addOns?.express
              });

              const isProcessed = quote.status === 'processed';

              return (
                <Card key={quote.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-6 flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-black border-accent text-accent uppercase tracking-widest">
                                Estimate #{quote.id.slice(0, 8)}
                              </Badge>
                              {details?.isStudent && <Badge className="bg-blue-500 text-[9px] font-black uppercase"><GraduationCap className="h-3 w-3 mr-1" /> Student</Badge>}
                              {details?.isMilitary && <Badge className="bg-green-600 text-[9px] font-black uppercase"><Shield className="h-3 w-3 mr-1" /> Military</Badge>}
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {quote.createdAt ? format(quote.createdAt.toDate(), "MMM d, yyyy") : "Date TBD"}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-primary capitalize">
                              {quote.moveSize || details?.moveSize || "Residential"} Move
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-primary">${estimatedTotal.toLocaleString()}</p>
                            <Badge 
                              className={
                                quote.status === 'processed' ? "bg-green-500 hover:bg-green-500" :
                                quote.status === 'expired' ? "bg-gray-400 hover:bg-gray-400" :
                                "bg-accent hover:bg-accent text-white"
                              }
                            >
                              {quote.status || 'pending'}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-primary"><MapPin className="h-4 w-4" /></div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Route</p>
                              <p className="text-sm font-bold">
                                {details?.pickupZip || "N/A"} → {details?.dropoffZip || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-primary"><Calendar className="h-4 w-4" /></div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Target Date</p>
                              <p className="text-sm font-bold">{details?.moveDate || "Flexible"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-primary"><Sparkles className="h-4 w-4" /></div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Add-ons</p>
                              <p className="text-sm font-bold">
                                {selectedAddOns.length} Selected
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-6 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l min-w-[200px]">
                        {!isProcessed && quote.paymentStatus === 'failed' && <p role="status" className="text-sm text-red-700 max-w-xs">Your payment did not complete. Your quote is still available—use Pay &amp; Book to try again.</p>}
                        {!isProcessed && quote.status !== 'expired' && (
                          <Button
                            type="button"
                            disabled={payingQuoteId === quote.id}
                            onClick={() => setCheckoutQuoteId(quote.id)}
                            className="w-full rounded-full bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-lg h-12 uppercase tracking-widest text-xs"
                          >
                            <CreditCard className="h-4 w-4" /> {payingQuoteId === quote.id ? "Opening Checkout..." : "Pay & Book"}
                          </Button>
                        )}
                        {isProcessed && (
                          <Button asChild className="w-full rounded-full bg-green-500 hover:bg-green-600 text-white font-bold h-12 uppercase tracking-widest text-xs">
                            <Link href="/dashboard/customer/moves">View Scheduled Move</Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)}
                          className="rounded-full font-bold text-primary hover:text-accent transition-all gap-2 group-hover:translate-x-1"
                        >
                          {expandedQuoteId === quote.id ? "Hide Details" : "Full Details"} <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {expandedQuoteId === quote.id && (
                      <div className="bg-slate-50 border-t border-slate-100 p-6 text-xs space-y-2 animate-fade-in">
                        <div className="flex flex-wrap gap-6">
                          <div>
                            <span className="font-black uppercase text-muted-foreground">Selected Add-ons: </span>
                            <span className="font-bold text-primary capitalize">
                              {selectedAddOns.length > 0 ? selectedAddOns.join(", ") : "Standard Move Only"}
                            </span>
                          </div>
                          <div>
                            <span className="font-black uppercase text-muted-foreground">Special Items: </span>
                            <span className="font-bold text-primary">
                              {quote.specialItems || details?.specialItems || "None listed"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-white">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-primary uppercase">No Quotes Found</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
                You haven't requested any moving estimates yet. Get an instant professional quote in just a few minutes.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 rounded-full px-8 h-12 font-bold">
                <Link href="/quote">Request a Quote</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
      <TermsConfirmation open={!!checkoutQuoteId} title="Review terms before payment" description="Accept the Terms of Service to book the selected quote. Payment is collected securely at Stripe checkout." confirmLabel="Continue to payment" busy={!!payingQuoteId} onConfirm={() => { if (checkoutQuoteId) void handlePayQuote(checkoutQuoteId); }} onCancel={() => setCheckoutQuoteId(null)}/>
    </CustomerLayout>
  );
}
