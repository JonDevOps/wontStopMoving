"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDoc, useMemoFirebase, useFirestore, useCollection } from "@/firebase";
import { doc, updateDoc, collection, query, where } from "firebase/firestore";
import { ArrowLeft, User, Truck, MapPin, Calendar, Check } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useState } from "react";

export default function AdminJobDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const firestore = useFirestore();
  const [updating, setUpdating] = useState(false);

  const jobRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "jobs", id);
  }, [firestore, id]);

  const { data: job, isLoading: jobLoading } = useDoc(jobRef);

  const providersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("role", "==", "provider"));
  }, [firestore]);

  const { data: providers, isLoading: providersLoading } = useCollection(providersQuery);

  const handleAssignProvider = async (providerId: string) => {
    if (!jobRef || !job) return;
    setUpdating(true);
    try {
      // Toggle assignment: If already assigned, remove it (reassignment logic)
      const currentProviders = job.providerIds || [];
      const newProviders = currentProviders.includes(providerId)
        ? currentProviders.filter((id: string) => id !== providerId)
        : [...currentProviders, providerId];

      await updateDoc(jobRef, { providerIds: newProviders });
    } catch (error) {
      console.error("Error assigning provider:", error);
      alert("Failed to assign provider. Check permissions.");
    } finally {
      setUpdating(false);
    }
  };

  if (jobLoading || providersLoading) {
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
          h1 <h1 className="text-3xl font-black text-primary uppercase">Job <span className="text-accent">{job.id.slice(0, 8)}</span></h1>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-accent" /> Assignment / God Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {job.preferredProviderId 
                  ? `Customer requested provider ID: ${job.preferredProviderId}` 
                  : "No specific provider requested by customer."}
              </p>
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Available Providers</h4>
                {providers && providers.length > 0 ? (
                  providers.map((p) => {
                    const isAssigned = job.providerIds?.includes(p.id);
                    const isPreferred = job.preferredProviderId === p.id;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isAssigned ? 'bg-green-500' : 'bg-slate-300'}`}>
                            {p.name?.[0] || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-primary flex items-center gap-2">
                              {p.name || "Unnamed"}
                              {isPreferred && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Customer Preferred</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </div>
                        </div>
                        <Button
                          variant={isAssigned ? "outline" : "default"}
                          size="sm"
                          disabled={updating}
                          onClick={() => handleAssignProvider(p.id)}
                          className={isAssigned ? "border-green-500 text-green-600 hover:bg-green-50" : ""}
                        >
                          {isAssigned ? <><Check className="w-4 h-4 mr-2" /> Assigned</> : "Assign"}
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
        </div>
      </div>
    </EmployeeLayout>
  );
}
