"use client";

import { ProviderLayout } from "@/components/layout/provider-layout";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Phone, Mail, Key } from "lucide-react";
import { format } from "date-fns";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface JobDetails {
  id: string;
  status: string;
  moveDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  hoursReserved?: number;
  price?: number;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export default function ProviderJobDetailsPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { user } = useUser();
  const firestore = useFirestore();

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [releaseCode, setReleaseCode] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);
  const { toast } = useToast();

  const handleCompleteJob = async () => {
    if (releaseCode.length !== 6) {
      toast({ variant: "destructive", title: "Invalid Code", description: "Please enter a 6-digit code." });
      return;
    }
    if (!job) return;
    setSubmittingCode(true);
    try {
      const res = await fetch("/api/jobs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, code: releaseCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete job");
      
      toast({ title: "Job Completed! 🎉", description: "Funds have been submitted for payout to your connected Stripe account." });
      setJob({ ...job, status: "completed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Completion Failed", description: err.message });
    } finally {
      setSubmittingCode(false);
    }
  };

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
      <ProviderLayout>
        <div className="p-20 text-center animate-pulse font-bold text-slate-500 uppercase tracking-widest text-xs">
          Accessing Job Details...
        </div>
      </ProviderLayout>
    );
  }

  if (!job) {
    return (
      <ProviderLayout>
        <div className="p-20 text-center font-bold text-slate-500 uppercase tracking-widest text-xs">
          Job not found
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Job File</h1>
              <Badge className="bg-slate-800 hover:bg-slate-800 text-white shadow-sm uppercase tracking-widest text-[10px] font-black px-3 py-1">
                {job.status}
              </Badge>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ID: {job.id}</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-md overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
                <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-accent" /> Logistics
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
                        <Clock className="w-3 h-3 text-slate-500" /> {job.hoursReserved} Hours
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

                {/* Customer Contact */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-900">{job.phone || 'Hidden'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-900">{job.email || 'Hidden'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(job.status === 'confirmed' || job.status === 'in-progress') && (
              <Card className="border-2 border-accent shadow-lg bg-accent/5 mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2 text-accent">
                    <Key className="w-5 h-5" /> Complete Job & Get Paid
                  </CardTitle>
                  <p className="text-xs font-medium text-slate-600 mt-1">
                    Ask the customer for their 6-digit Payment Release Code to complete this job and transfer your 85% payout.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Input 
                      type="text" 
                      placeholder="000000" 
                      className="text-center text-2xl font-black tracking-[0.2em] h-14 bg-white"
                      maxLength={6}
                      value={releaseCode}
                      onChange={(e) => setReleaseCode(e.target.value)}
                    />
                    <Button 
                      disabled={submittingCode}
                      onClick={handleCompleteJob}
                      className="h-14 px-8 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest"
                    >
                      {submittingCode ? "Verifying..." : "Complete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* The user.displayName will be the provider's display name or email prefix */}
            <ChatInterface 
              jobId={job.id} 
              currentUserUid={user?.uid || ""} 
              currentUserName={user?.displayName || "Provider"} 
            />
          </div>
        </div>
      </div>
    </ProviderLayout>
  );
}
