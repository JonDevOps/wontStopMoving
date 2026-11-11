"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDoc, useMemoFirebase, useFirestore, useCollection } from "@/firebase";
import { doc, updateDoc, collection, query, where } from "firebase/firestore";
import { DispatchSuggestions } from "@/components/admin/dispatch-suggestions";
import { ArrowLeft, User, Truck, MapPin, Calendar, Check, DollarSign, Key, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
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

  const providersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "providers"));
  }, [firestore]);

  const employeesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("role", "==", "employee"));
  }, [firestore]);

  const { data: providers, isLoading: providersLoading } = useCollection(providersQuery);
  const { data: employees, isLoading: employeesLoading } = useCollection(employeesQuery);

  const handleAssignProvider = async (providerId: string) => {
    if (!jobRef || !job) return;
    setUpdating(true);
    try {
      const currentProviders = job.providerIds || [];
      const newProviders = currentProviders.includes(providerId)
        ? currentProviders.filter((id: string) => id !== providerId)
        : [...currentProviders, providerId];

      await updateDoc(jobRef, { providerIds: newProviders });
      toast({ title: "Provider Updated", description: "Provider assignment updated for this job." });
    } catch (error) {
      console.error("Error assigning provider:", error);
      toast({ variant: "destructive", title: "Assignment Failed", description: "Failed to assign provider. Check permissions." });
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignEmployee = async (employeeId: string) => {
    if (!jobRef || !job) return;
    setUpdating(true);
    try {
      const currentEmployees = job.employeeIds || [];
      const newEmployees = currentEmployees.includes(employeeId)
        ? currentEmployees.filter((id: string) => id !== employeeId)
        : [...currentEmployees, employeeId];

      await updateDoc(jobRef, { employeeIds: newEmployees });
      toast({ title: "Crew Member Updated", description: "Employee crew assignment updated for this job." });
    } catch (error) {
      console.error("Error assigning employee:", error);
      toast({ variant: "destructive", title: "Assignment Failed", description: "Failed to assign employee." });
    } finally {
      setUpdating(false);
    }
  };

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

  if (jobLoading || providersLoading || employeesLoading) {
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
                  {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "TBD"}
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

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-accent" /> Marketplace Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {job.preferredProviderId 
                  ? `Customer requested provider ID: ${job.preferredProviderId}` 
                  : "Assign an independent service provider to fulfill this move."}
              </p>
              <div className="space-y-3">
                {providers && providers.length > 0 ? (
                  providers.map((p) => {
                    const isAssigned = job.providerIds?.includes(p.id);
                    const isPreferred = job.preferredProviderId === p.id;
                    const displayName = p.businessName || p.name || "Provider";
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isAssigned ? 'bg-green-500' : 'bg-slate-800'}`}>
                            {displayName[0]?.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-primary flex items-center gap-2">
                              {displayName}
                              {isPreferred && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Preferred</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${p.hourlyRate || 50}/hr • {p.status || "pending"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={isAssigned ? "outline" : "default"}
                          size="sm"
                          disabled={updating}
                          onClick={() => handleAssignProvider(p.id)}
                          className={isAssigned ? "border-green-500 text-green-600 hover:bg-green-50" : ""}
                        >
                          {isAssigned ? <><Check className="w-4 h-4 mr-1" /> Assigned</> : "Assign"}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground italic">No providers available.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-accent" /> Internal W-2 Crew</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Assign internal Wont Stop Moving employees to this job dispatch.
              </p>
              <div className="space-y-3">
                {employees && employees.length > 0 ? (
                  employees.map((emp) => {
                    const isAssigned = job.employeeIds?.includes(emp.id);
                    return (
                      <div key={emp.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isAssigned ? 'bg-green-500' : 'bg-primary'}`}>
                            {emp.name?.[0]?.toUpperCase() || 'E'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-primary">{emp.name || "Employee"}</p>
                            <p className="text-xs text-muted-foreground">{emp.email} • {emp.state || "US"}</p>
                          </div>
                        </div>
                        <Button
                          variant={isAssigned ? "outline" : "default"}
                          size="sm"
                          disabled={updating}
                          onClick={() => handleAssignEmployee(emp.id)}
                          className={isAssigned ? "border-green-500 text-green-600 hover:bg-green-50" : ""}
                        >
                          {isAssigned ? <><Check className="w-4 h-4 mr-1" /> Dispatched</> : "Dispatch"}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground italic">No employees available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
