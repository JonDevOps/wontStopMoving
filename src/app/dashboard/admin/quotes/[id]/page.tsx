
"use client";

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Mail, Phone, MapPin, Calculator, Calendar, ShieldCheck, CheckCircle, XCircle, Clock, Truck } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { generateQuoteDescription } from "@/ai/flows/ai-quote-description-generator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { calculateMoveTotal } from "@/lib/pricing";

function QuoteReviewContent({ id }: { id: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const quoteRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "quotes", id);
  }, [firestore, id]);

  const { data: quote, isLoading } = useDoc(quoteRef);
  
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpdateStatus = async (newStatus: 'processed' | 'expired' | 'new') => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, "quotes", id), {
        status: newStatus
      });

      toast({
        title: "Status Updated",
        description: `Estimate has been marked as ${newStatus}.`,
      });
    } catch (error: any) {
      console.error("Status Update Error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "You may not have permission to perform this action.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiDescription = async () => {
    if (!quote) return;
    setIsSummarizing(true);
    try {
      const price = calculateMoveTotal(quote.moveSize, []); // Basic calc for description
      const result = await generateQuoteDescription({
        moveSize: quote.moveSize as any,
        pickupAddress: quote.pickupZip,
        dropoffAddress: quote.dropoffZip,
        estimatedHours: 4, // Placeholder
        price: price,
        specialItems: quote.specialItems
      });
      setAiSummary(result.description);
    } catch (error) {
      console.error("AI Error:", error);
      toast({
        variant: "destructive",
        title: "AI Generation Failed",
        description: "Check Genkit configuration or input parameters."
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading) return <div className="p-20 text-center font-bold text-primary animate-pulse uppercase tracking-widest">Loading Estimate...</div>;
  if (!quote) return <div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Estimate not found.</div>;

  // Safely parse details
  let details: any = {};
  try {
    details = typeof quote.details === 'string' ? JSON.parse(quote.details) : quote.details;
  } catch (e) {
    console.warn("Could not parse details JSON");
  }

  const selectedAddOns = Object.entries(details?.addOns || {})
    .filter(([_, active]) => active)
    .map(([key]) => key);

  const price = calculateMoveTotal(quote.moveSize || details?.moveSize || "studio", selectedAddOns, {
    isStudent: !!details?.isStudent,
    isMilitary: !!details?.isMilitary,
    isExpress: !!details?.addOns?.express
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <Link href="/dashboard/admin/quotes" className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Quotes
      </Link>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center text-2xl font-black">
            <Calculator className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">{quote.name || "Anonymous"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                className={
                  quote.status === 'processed' ? "bg-green-500" : 
                  quote.status === 'expired' ? "bg-gray-400" : 
                  "bg-orange-500"
                }
              >
                {quote.status || 'new'}
              </Badge>
              <span className="text-sm text-muted-foreground uppercase font-black tracking-widest">EST: #{quote.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Estimated Total</p>
          <p className="text-4xl font-black text-primary">${price.toLocaleString()}</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {aiSummary && (
            <Card className="border-accent/20 bg-accent/5 shadow-sm overflow-hidden animate-fade-in">
              <CardHeader className="bg-accent text-white flex flex-row items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <CardTitle className="text-sm font-black tracking-widest uppercase">AI Service Proposal</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-primary font-medium leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent" />
                Move Logistics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 pt-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><MapPin className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Route</p>
                    <p className="font-bold text-primary">{quote.pickupZip} → {quote.dropoffZip}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Calendar className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Target Date</p>
                    <p className="font-bold text-primary">{quote.moveDate || "Flexible"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Calculator className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Move Size</p>
                    <p className="font-bold text-primary capitalize">{quote.moveSize} Move</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Clock className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Submitted</p>
                    <p className="font-bold text-primary">
                      {quote.createdAt ? format(quote.createdAt.toDate(), "MMMM d, yyyy 'at' h:mm a") : "Just now"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Premium Add-ons & Items</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedAddOns.length > 0 ? selectedAddOns.map((addon) => (
                  <div key={addon} className="flex items-center gap-2 p-3 bg-accent/5 rounded-xl border border-accent/10">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span className="text-xs font-bold text-primary uppercase truncate">{addon}</span>
                  </div>
                )) : (
                  <p className="text-sm italic text-muted-foreground col-span-full">No add-ons selected.</p>
                )}
              </div>

              {quote.specialItems && (
                <div className="space-y-2 pt-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Special Handling Instructions</p>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm font-medium text-primary italic">
                    "{quote.specialItems}"
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          <Card className="border-none shadow-sm bg-primary text-white">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase">CONTACT INFO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-accent" />
                  <span className="text-sm font-bold truncate">{quote.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-accent" />
                  <span className="text-sm font-bold">{quote.phone}</span>
                </div>
              </div>
              <Button asChild variant="ghost" className="w-full text-white hover:bg-white/10 border border-white/20 rounded-xl font-bold uppercase tracking-widest text-[10px] h-10">
                <Link href={`mailto:${quote.email}`}>Send Email</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-t-4 border-accent">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase text-primary">ADMIN ACTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleAiDescription} 
                disabled={isSummarizing}
                className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl font-bold h-12 uppercase text-xs flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isSummarizing ? "Analyzing..." : "Generate AI Proposal"}
              </Button>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => handleUpdateStatus('processed')}
                  disabled={isProcessing || quote.status === 'processed'}
                  variant="outline"
                  className="rounded-xl font-bold h-12 uppercase text-[10px] gap-2 border-green-200 text-green-600 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Processed
                </Button>
                <Button 
                  onClick={() => handleUpdateStatus('expired')}
                  disabled={isProcessing || quote.status === 'expired'}
                  variant="outline"
                  className="rounded-xl font-bold h-12 uppercase text-[10px] gap-2 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  Expire
                </Button>
              </div>

              {quote.status !== 'new' && (
                <Button 
                  onClick={() => handleUpdateStatus('new')}
                  disabled={isProcessing}
                  variant="link" 
                  className="w-full text-muted-foreground text-[10px] uppercase font-bold"
                >
                  Reset to Pending
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function QuoteReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <EmployeeLayout isAdmin>
      <QuoteReviewContent id={id} />
    </EmployeeLayout>
  );
}
