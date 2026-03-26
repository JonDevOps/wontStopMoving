"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, DollarSign, User, Key } from "lucide-react";
import { format } from "date-fns";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ReviewForm } from "@/components/forms/review-form";

interface JobDetails {
  id: string;
  status: string;
  moveDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  hoursReserved?: number;
  price?: number;
  providerIds?: string[];
  [key: string]: any;
}

export default function CustomerJobDetailsPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { user } = useUser();
  const firestore = useFirestore();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!firestore || !jobId) return;
      try {
        const docSnap = await getDoc(doc(firestore, "jobs", jobId));
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() } as JobDetails);
        }
      } catch (err) {
        console.error("Error fetching job:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [firestore, jobId]);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="p-20 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-xs">
          Accessing Job Details...
        </div>
      </CustomerLayout>
    );
  }

  if (!job) {
    return (
      <CustomerLayout>
        <div className="p-20 text-center font-bold text-muted-foreground uppercase tracking-widest text-xs">
          Job not found
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Job Details</h1>
              <Badge className="bg-accent hover:bg-accent text-white shadow-sm uppercase tracking-widest text-[10px] font-black px-3 py-1">
                {job.status}
              </Badge>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ID: {job.id}</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl px-6 py-4">
                <CardTitle className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" /> Logistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Move Date</h4>
                    <p className="font-bold text-slate-900">{job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "TBD"}</p>
                  </div>
                  {job.hoursReserved && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reserved Time</h4>
                      <p className="font-bold text-slate-900 flex items-center gap-1">
                        <Clock className="w-4 h-4 text-accent" /> {job.hoursReserved} Hours
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pickup</h4>
                    <p className="font-bold text-slate-900">{job.pickupAddress}</p>
                  </div>
                  <div className="col-span-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Drop-off</h4>
                    <p className="font-bold text-slate-900">{job.dropoffAddress}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {job.price && (
              <Card className="border-2 border-slate-900 shadow-lg overflow-hidden">
                <div className="p-6 flex justify-between items-center bg-white">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">
                      {job.modifications?.length ? "Updated Total" : "Est. Total"}
                    </h4>
                    <p className="text-sm font-bold text-slate-500">
                      {job.modifications?.length ? "Includes Extra Charges" : "Fixed Upfront Booking"}
                    </p>
                  </div>
                  <div className="text-3xl font-black text-slate-900">
                    ${job.price.toLocaleString()}<span className="text-lg text-slate-400">.00</span>
                  </div>
                </div>
                {job.modifications && job.modifications.length > 0 && (
                  <div className="bg-slate-50 border-t border-slate-100 p-6 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Extra Charges & Modifications</h4>
                    {job.modifications.map((mod: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-700">{mod.description}</span>
                        <span className="font-black text-slate-900">+${mod.amount.toLocaleString()}.00</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {job.status !== 'completed' && job.releaseCode && (
              <Card className="border-none shadow-xl bg-accent text-white mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                    <Key className="w-5 h-5" /> Payment Release Code
                  </CardTitle>
                  <CardDescription className="text-accent-foreground/80 text-xs font-medium mt-1">
                    Give this 6-digit code to your provider ONLY when the job is completely finished to your satisfaction.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-black tracking-[0.2em]">{job.releaseCode}</div>
                </CardContent>
              </Card>
            )}

            {job.status === 'completed' && !job.reviewed && job.providerIds?.[0] && (
              <ReviewForm 
                jobId={job.id} 
                providerId={job.providerIds[0]} 
                onReviewSubmitted={() => setJob(prev => prev ? { ...prev, reviewed: true } : prev)} 
              />
            )}
          </div>

          <div className="space-y-6">
            <ChatInterface jobId={job.id} currentUserUid={user?.uid || ""} currentUserName={user?.displayName || "Customer"} />
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
