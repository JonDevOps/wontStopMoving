"use client";

import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, useMemoFirebase, useUser, useFirestore } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Briefcase, Calendar, MapPin, Package, ChevronRight, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";

export default function ProviderJobsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Query for provider's assigned jobs
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("providerIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [firestore, user]);

  const { data: jobs, isLoading } = useCollection(jobsQuery);

  return (
    <ProviderLayout>
      <div className="space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase">My <span className="text-accent">Jobs</span></h1>
            <p className="text-muted-foreground">Manage your assigned and upcoming moving jobs</p>
          </div>
        </header>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="p-20 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-xs">
              Retrieving assigned jobs...
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
                          <h3 className="text-xl font-bold text-slate-800">
                            {job.pickupZip || 'TBD'} to {job.dropoffZip || 'TBD'}
                          </h3>
                        </div>
                        <Badge 
                          className={
                            job.status === 'completed' ? "bg-green-500 hover:bg-green-500" :
                            job.status === 'in-progress' ? "bg-blue-500 hover:bg-blue-500" :
                            "bg-slate-800 hover:bg-slate-800 text-white"
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-700"><Calendar className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Date</p>
                            <p className="text-sm font-bold text-slate-900">
                              {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "TBD"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-700"><Package className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Size</p>
                            <p className="text-sm font-bold text-slate-900 capitalize">{job.moveSize || 'Standard'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-700"><MapPin className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Distance</p>
                            <p className="text-sm font-bold text-slate-900">Local Move</p>
                          </div>
                        </div>
                      </div>

                      {/* Customer Contact Stub for Providers */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{job.phone || 'Hidden'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{job.email || 'Hidden'}</span>
                        </div>
                      </div>

                    </div>
                    <div className="bg-slate-50 p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100">
                      <Button asChild variant="outline" className="rounded-full font-bold border-accent text-accent hover:bg-accent hover:text-white transition-all gap-2 w-full mb-3">
                        <Link href={`/dashboard/provider/jobs/${job.id}`}>
                          Job Details <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button className="rounded-full font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all w-full">
                        Update Status
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="p-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
              <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Assigned Jobs</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto mt-2">
                You do not have any jobs assigned to you at the moment. When a customer requests you, or an admin assigns you a job, it will appear here.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 rounded-full px-8 h-12 font-bold text-white shadow-lg shadow-accent/20">
                <Link href="/dashboard/provider">Return to Dashboard</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </ProviderLayout>
  );
}
