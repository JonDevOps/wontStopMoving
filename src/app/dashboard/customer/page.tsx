
"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, FileText, Calendar, ArrowRight, Package, Clock } from "lucide-react";
import { useCollection, useMemoFirebase, useUser, useFirestore } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CustomerDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Query for user's quotes
  const quotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "quotes"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(3)
    );
  }, [firestore, user]);

  // Query for user's active jobs
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(3)
    );
  }, [firestore, user]);

  const { data: quotes, isLoading: quotesLoading } = useCollection(quotesQuery);
  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery);

  const stats = [
    { label: "Active Moves", value: jobs?.length || "0", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pending Quotes", value: quotes?.length || "0", icon: FileText, color: "text-accent", bg: "bg-accent/10" },
    { label: "Total Completed", value: "0", icon: Package, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <CustomerLayout>
      <div className="space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">Move <span className="text-accent">Summary</span></h1>
            <p className="text-muted-foreground">Manage your upcoming relocations and service requests</p>
          </div>
          <Button asChild className="rounded-full bg-accent hover:bg-accent/90 px-8 h-12 font-bold uppercase tracking-wider">
            <Link href="/quote">Request New Quote</Link>
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-black text-primary">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Active Moves */}
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent" />
                Active Moves
              </CardTitle>
              <Link href="/dashboard/customer/moves" className="text-xs font-bold text-accent hover:underline">See All</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading moves...</div>
                ) : jobs && jobs.length > 0 ? (
                  jobs.map((job) => (
                    <div key={job.id} className="p-4 bg-gray-50 rounded-xl border border-transparent hover:border-accent transition-all cursor-pointer group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-bold text-accent uppercase mb-1">{job.id}</p>
                          <p className="font-bold text-primary">{job.pickupAddress.split(',')[0]} to {job.dropoffAddress.split(',')[0]}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" /> Scheduled for {job.moveDate}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">{job.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-bold text-primary">No active moves</p>
                    <p className="text-xs text-muted-foreground">Your scheduled jobs will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Quotes */}
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Recent Quotes
              </CardTitle>
              <Link href="/dashboard/customer/quotes" className="text-xs font-bold text-accent hover:underline">See All</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quotesLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading quotes...</div>
                ) : quotes && quotes.length > 0 ? (
                  quotes.map((quote) => (
                    <div key={quote.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between group cursor-pointer border border-transparent hover:border-accent transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded-lg text-primary shadow-sm"><Clock className="h-4 w-4" /></div>
                        <div>
                          <p className="font-bold text-primary">{quote.moveSize} Move</p>
                          <p className="text-xs text-muted-foreground">Requested {new Date(quote.createdAt?.toDate()).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-bold text-primary">No quotes requested</p>
                    <p className="text-xs text-muted-foreground">Request your first free quote today!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}
