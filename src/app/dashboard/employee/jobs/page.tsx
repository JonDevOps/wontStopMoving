
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, ChevronRight, Truck, Lock, Package } from "lucide-react";
import Link from "next/link";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function EmployeeJobsContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"active" | "history">("active");

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("employeeIds", "array-contains", user.uid)
    );
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc(employeeRef);
  const { data: assignedJobs, isLoading: jobsLoading } = useCollection(jobsQuery);

  if (isLoading || jobsLoading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-primary uppercase text-sm">Validating Access...</div>
    );
  }

  const isActive = profile?.status === 'active';
  const filteredJobs = (assignedJobs || []).filter((j) =>
    filter === "active"
      ? j.status !== "completed" && j.status !== "cancelled"
      : j.status === "completed" || j.status === "cancelled"
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase">My Assigned <span className="text-accent">Jobs</span></h1>
          <p className="text-muted-foreground">Manage your current and upcoming crew assignments</p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <Button
              variant={filter === "active" ? "default" : "outline"}
              onClick={() => setFilter("active")}
              className="rounded-full font-bold text-xs uppercase"
            >
              Active ({(assignedJobs || []).filter((j) => j.status !== "completed" && j.status !== "cancelled").length})
            </Button>
            <Button
              variant={filter === "history" ? "default" : "ghost"}
              onClick={() => setFilter("history")}
              className="rounded-full font-bold text-xs uppercase"
            >
              History ({(assignedJobs || []).filter((j) => j.status === "completed" || j.status === "cancelled").length})
            </Button>
          </div>
        )}
      </header>

      {!isActive ? (
        /* LOCKED VIEW FOR APPLICANTS */
        <Card className="border-none shadow-2xl bg-white overflow-hidden py-20 text-center">
          <CardContent className="space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 bg-orange-50 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black text-primary uppercase">Awaiting Activation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your account is currently in **Training Status**. Job assignments and customer logistics are restricted until an administrator has reviewed your application and approved you for active duty.
            </p>
            <Button asChild className="bg-primary rounded-full px-8 font-bold">
              <Link href="/dashboard/employee">Go to Employee Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filteredJobs.length > 0 ? (
        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="border-none shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">Job #{job.id.slice(0, 8)}</span>
                    <Badge className="bg-primary uppercase text-[10px] font-black">{job.status}</Badge>
                  </div>
                  <h3 className="text-lg font-black text-primary">
                    {job.pickupAddress?.split(",")[0] || "Local Pickup"} → {job.dropoffAddress?.split(",")[0] || "Local Drop-off"}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-accent" />
                      {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "TBD"}
                    </span>
                    <span className="flex items-center gap-1 capitalize">
                      <Package className="h-3.5 w-3.5 text-accent" />
                      {job.moveSize || "Standard"} Move
                    </span>
                  </div>
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 text-white rounded-full font-bold text-xs uppercase tracking-widest gap-2">
                  <Link href={`/dashboard/employee/jobs/${job.id}`}>
                    Open Dispatch Sheet <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ACTIVE JOBS EMPTY STATE */
        <div className="grid gap-4">
          <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-white">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-primary uppercase">Ready for Dispatch</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {filter === "active"
                ? "You don't have any active jobs assigned at the moment."
                : "No completed jobs in your history yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              New jobs appear here as soon as an admin assigns you to a move.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeJobsPage() {
  return (
    <EmployeeLayout>
      <EmployeeJobsContent />
    </EmployeeLayout>
  );
}
