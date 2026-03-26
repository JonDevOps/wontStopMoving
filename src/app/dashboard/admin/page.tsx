
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, FileText, TrendingUp, AlertCircle, ChevronRight, Megaphone, Send, Calculator, UserCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCollection, useMemoFirebase, useFirestore, addDocumentNonBlocking, useDoc, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, serverTimestamp, where } from "firebase/firestore";
import Link from "next/link";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function AdminDashboardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const appsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "applications"), orderBy("createdAt", "desc"), limit(5));
  }, [firestore]);

  const quotesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "quotes"), orderBy("createdAt", "desc"), limit(5));
  }, [firestore]);

  const pendingQuotesCountQuery = useMemoFirebase(() => {
    return query(collection(firestore, "quotes"), where("status", "==", "new"));
  }, [firestore]);

  const pendingProvidersQuery = useMemoFirebase(() => {
    return query(collection(firestore, "providers"), where("status", "==", "pending_approval"), limit(5));
  }, [firestore]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, "users", authUser.uid);
  }, [firestore, authUser]);

  const { data: profile } = useDoc(userProfileRef);
  const { data: applications, isLoading: appsLoading } = useCollection(appsQuery);
  const { data: quotes, isLoading: quotesLoading } = useCollection(quotesQuery);
  const { data: pendingQuotes } = useCollection(pendingQuotesCountQuery);
  const { data: pendingProviders, isLoading: providersLoading } = useCollection(pendingProvidersQuery);

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementContent) return;

    setIsSending(true);
    try {
      const announcementsRef = collection(firestore, "announcements");
      await addDocumentNonBlocking(announcementsRef, {
        title: announcementTitle,
        content: announcementContent,
        authorName: profile?.name || "Administrator",
        createdAt: serverTimestamp(),
        type: "system"
      });

      toast({
        title: "Announcement Broadcasted",
        description: "Your message is now live on all employee dashboards.",
      });

      setAnnouncementTitle("");
      setAnnouncementContent("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Broadcast Failed",
        description: "There was an error sending the announcement.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const kpis = [
    { label: "Total Revenue", value: "$42,850", trend: "+12.5%", icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Active Jobs", value: "32", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pending Quotes", value: String(pendingQuotes?.length || 0), icon: Calculator, color: "text-accent", bg: "bg-accent/10" },
    { label: "Pending Providers", value: String(pendingProviders?.length || 0), icon: UserCheck, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-primary uppercase">System <span className="text-accent">Overview</span></h1>
        <p className="text-muted-foreground">Nationwide Logistics Control Center</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
                {kpi.trend && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{kpi.trend}</span>
                )}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className="text-3xl font-black text-primary mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Recent Quotes */}
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black tracking-widest uppercase">RECENT QUOTES</CardTitle>
                <Link href="/dashboard/admin/quotes" className="text-[10px] font-bold text-accent hover:underline uppercase">View All</Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quotesLoading ? (
                    <div className="p-4 text-center text-muted-foreground animate-pulse text-xs">Syncing estimates...</div>
                  ) : quotes && quotes.length > 0 ? (
                    quotes.map((quote) => (
                      <Link key={quote.id} href={`/dashboard/admin/quotes/${quote.id}`}>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group mb-2 border border-transparent hover:border-accent/20">
                          <div className="min-w-0">
                            <p className="font-bold text-primary text-sm truncate">{quote.name || "Anonymous"}</p>
                            <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                              {quote.moveSize} • {quote.createdAt ? format(quote.createdAt.toDate(), "MMM d") : "New"}
                            </p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground">No recent quotes.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pending Providers */}
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black tracking-widest uppercase text-amber-600">PENDING PROVIDERS</CardTitle>
                <Link href="/dashboard/admin/providers" className="text-[10px] font-bold text-accent hover:underline uppercase">Manage All</Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {providersLoading ? (
                    <div className="p-4 text-center text-muted-foreground animate-pulse text-xs">Loading provider queue...</div>
                  ) : pendingProviders && pendingProviders.length > 0 ? (
                    pendingProviders.map((provider) => (
                      <Link key={provider.id} href={`/dashboard/admin/providers`}>
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer group mb-2 border border-transparent hover:border-amber-200">
                          <div className="min-w-0">
                            <p className="font-bold text-amber-900 text-sm truncate">{provider.businessName || provider.name}</p>
                            <p className="text-[9px] uppercase font-black text-amber-700/70 tracking-widest">
                              {provider.address?.city || "Unknown City"} • {provider.services?.length || 0} Services
                            </p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-amber-700 group-hover:text-amber-900 transition-colors shrink-0" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed rounded-2xl">
                      <p className="text-[10px] font-bold text-muted-foreground">All providers reviewed.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary text-white flex flex-row items-center gap-2">
              <Megaphone className="h-5 w-5 text-accent" />
              <CardTitle className="text-sm font-black tracking-widest uppercase">System Broadcast</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Announcement Title" 
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="border-gray-200 h-12 font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Broadcast message to all 51,000 employees..." 
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="min-h-[120px] border-gray-200"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isSending || !announcementTitle || !announcementContent}
                    className="bg-accent hover:bg-accent/90 text-white rounded-full px-8 gap-2 font-bold uppercase tracking-widest text-xs h-12"
                  >
                    <Send className="h-4 w-4" />
                    {isSending ? "Broadcasting..." : "Send Announcement"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-black tracking-widest uppercase">REGIONAL CAPACITY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { state: "Texas", capacity: 85 },
                { state: "Ontario", capacity: 74 },
                { state: "California", capacity: 68 },
                { state: "British Columbia", capacity: 59 },
                { state: "Ohio", capacity: 42 },
                { state: "Puerto Rico", capacity: 25 },
              ].map((region, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>{region.state}</span>
                    <span className="text-accent">{region.capacity}%</span>
                  </div>
                  <Progress value={region.capacity} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <EmployeeLayout isAdmin>
      <AdminDashboardContent />
    </EmployeeLayout>
  );
}
