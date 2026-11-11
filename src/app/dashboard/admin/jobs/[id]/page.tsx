"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { DispatchSuggestions } from "@/components/admin/dispatch-suggestions";
import { MoveDetailsEditor } from "@/components/jobs/move-details-editor";
import { JobTeamPanel } from "@/components/jobs/job-team-panel";
import { formatMoveDate } from "@/lib/move-details";
import { ArrowLeft, MapPin, DollarSign, Key, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminJobDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const jobRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "jobs", id);
  }, [firestore, id]);

  const { data: job, isLoading: jobLoading } = useDoc(jobRef);

  const secretRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "jobSecrets", id);
  }, [firestore, id]);
  const { data: jobSecret } = useDoc(secretRef);

  const forceCompleteJob = async () => {
    if (!jobRef || !job) return;
    setUpdating(true);
    try {
      await updateDoc(jobRef, { status: "completed" });
      toast({ title: "Job Force Completed", description: "Payment manually released to the provider." });
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not modify job state." });
    } finally {
      setUpdating(false);
    }
  };

  const handleRefundJob = async () => {
    if (!jobRef || !job) return;
    setUpdating(true);
    try {
      await updateDoc(jobRef, { status: "cancelled" });
      toast({ title: "Job Cancelled & Refunded", description: "Payment hold cancelled and marked for customer refund." });
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not refund job." });
    } finally {
      setUpdating(false);
    }
  };

  if (jobLoading) {
    return (
      <EmployeeLayout isAdmin>
        <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
          Loading Job Details...
        </div>
      </EmployeeLayout>
    );
  }

  if (!job) {
    return (
      <EmployeeLayout isAdmin>
        <div className="p-20 text-center font-bold text-red-500 uppercase">Job not found.</div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout isAdmin>
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/admin/jobs"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-3xl font-black text-primary uppercase">Job <span className="text-accent">{job.id.slice(0, 8)}</span></h1>
          <Badge className="uppercase text-[10px] font-black">{job.status}</Badge>
        </div>

        <MoveDetailsEditor jobId={id} job={job} />

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" /> Logistics Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Pickup</p>
                <p className="font-medium text-sm">{job.pickupAddress}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Drop-off</p>
                <p className="font-medium text-sm">{job.dropoffAddress}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Date</p>
                <p className="font-medium text-sm">
                  {formatMoveDate(job.moveDate)}{job.moveTime ? ` · ${job.moveTime}` : ""}
                </p>
              </div>
              {job.hoursReserved && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Reserved Time</p>
                  <p className="font-medium text-sm">{job.hoursReserved} Hours</p>
                </div>
              )}
              {job.moveSize && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Size</p>
                  <p className="font-medium text-sm capitalize">{job.moveSize}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment and payout card */}
          <Card className="border-2 border-accent/20 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-accent"><DollarSign className="h-5 w-5" /> Payment & Payout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-accent/10">
                <p className="text-xs font-bold text-muted-foreground uppercase">Captured Value</p>
                <p className="font-black text-xl text-slate-900">${job.price?.toLocaleString() || "0"}.00</p>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-accent/10">
                <p className="text-xs font-bold text-muted-foreground uppercase">Release Code</p>
                {jobSecret?.releaseCode ? (
                  <p className="font-black text-lg tracking-[0.2em]">{jobSecret.releaseCode}</p>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase">Not Generated</Badge>
                )}
              </div>

              <div className="flex justify-between items-center py-2 border-b border-accent/10">
                <p className="text-xs font-bold text-muted-foreground uppercase">Payout State</p>
                {job.status === 'confirmed' || job.status === 'in-progress' ? (
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-[10px] uppercase">Locked</Badge>
                ) : job.status === 'completed' ? (
                  <Badge className="bg-green-500 hover:bg-green-600 text-[10px] uppercase">Released</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase">{job.status}</Badge>
                )}
              </div>

              {(job.status === 'confirmed' || job.status === 'in-progress') && (
                <div className="pt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-accent text-accent hover:bg-accent hover:text-white uppercase tracking-widest text-[10px] font-black"
                    onClick={forceCompleteJob}
                    disabled={updating}
                  >
                    <Key className="w-4 h-4 mr-2" /> Force Release
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 uppercase tracking-widest text-[10px] font-black"
                    onClick={handleRefundJob}
                    disabled={updating}
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" /> Refund
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DispatchSuggestions jobId={id} />

        <JobTeamPanel jobId={id} admin refreshKey={JSON.stringify([job.providerIds, job.employeeIds, job.agentAssignments])} />
      </div>
    </EmployeeLayout>
  );
}
