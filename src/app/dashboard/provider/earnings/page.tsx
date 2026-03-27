"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle2, Loader2, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ProviderLayout } from "@/components/layout/provider-layout";

type Job = {
  id: string;
  customerId: string;
  status: string;
  price: number;
  scheduledDate: Timestamp;
  location: { address: string };
  releasedToProvider?: boolean;
};

export default function ProviderEarningsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !firestore) return;

    const fetchEarnings = async () => {
      try {
        const jobsRef = collection(firestore, "jobs");
        const q = query(
          jobsRef,
          where("providerIds", "array-contains", user.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const fetchedJobs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Job[];
        
        setJobs(fetchedJobs);
      } catch (error) {
        console.error("Error fetching earnings data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [user]);

  if (loading) {
    return (
      <ProviderLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </ProviderLayout>
    );
  }

  // Calculate totals
  const completedJobs = jobs.filter(j => j.status === "completed");
  const uncompletedJobs = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");

  const totalEarned = completedJobs.reduce((acc, job) => acc + (job.price || 0), 0);
  const pendingEscrow = uncompletedJobs.reduce((acc, job) => acc + (job.price || 0), 0);
  const totalJobsDone = completedJobs.length;

  return (
    <ProviderLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-green-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available to Payout</CardTitle>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalEarned.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> From {totalJobsDone} completed jobs
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending in Escrow</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${pendingEscrow.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1 text-blue-600/80">
                Secured by Wont Stop Moving Escrow
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-100 lg:flex lg:flex-col lg:justify-center bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden">
             <div className="absolute right-0 top-0 opacity-5">
               <DollarSign className="w-32 h-32 -mt-4 -mr-4" />
             </div>
             <CardContent className="pt-6 relative z-10">
               <h3 className="font-semibold text-lg text-slate-800">Ready to Cash Out?</h3>
               <p className="text-sm text-slate-500 mb-4 mt-1">Connect your bank account to withdraw your available balance instantly via Stripe Connect.</p>
               <button className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center">
                 Setup Payouts <ArrowUpRight className="w-4 h-4 ml-1 opacity-70" />
               </button>
             </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="border-gray-100 shadow-sm mt-8">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto text-gray-200 mb-4" />
                <p>No earnings history yet.</p>
                <p className="text-sm">Complete your first job to see profits here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all">
                    <div className="flex items-start space-x-4">
                      <div className={`mt-0.5 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                        job.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                         {job.status === 'completed' ? (
                           <DollarSign className="h-5 w-5 text-green-600" />
                         ) : (
                           <Clock className="h-5 w-5 text-blue-600" />
                         )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Job: {job.location?.address?.split(',')[0] || "Local Move"}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {job.scheduledDate ? format(job.scheduledDate.toDate(), "MMM d, yyyy") : "Date TBD"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className={`font-bold text-lg ${job.status === 'completed' ? 'text-green-600' : 'text-slate-900'}`}>
                        ${job.price?.toFixed(2) || "0.00"}
                      </p>
                      {job.status === 'completed' ? (
                        <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 mt-1">Available</Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 mt-1">In Escrow</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProviderLayout>
  );
}
