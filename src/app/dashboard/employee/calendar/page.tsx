"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, MapPin, Truck } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";

export default function EmployeeCalendarPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("assignedEmployeeIds", "array-contains", user.uid)
    );
  }, [firestore, user]);

  const { data: jobs, isLoading } = useCollection(jobsQuery);

  return (
    <EmployeeLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tight">
            Dispatch <span className="text-accent">Calendar</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Your upcoming move assignments and shift schedule
          </p>
        </header>

        <Card className="border-none shadow-sm bg-white rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-accent" />
              Scheduled Crew Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">
                Loading dispatch calendar...
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary text-white border-none text-[10px] font-black uppercase">
                          {job.moveDate || "Upcoming"}
                        </Badge>
                        <span className="text-xs font-bold text-muted-foreground">
                          #{job.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="font-black text-primary text-base flex items-center gap-2">
                        <Truck className="h-4 w-4 text-accent" />
                        {job.pickupAddress || "Origin"} → {job.dropoffAddress || "Destination"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" /> Move Size: {job.moveSize || "Standard"}
                      </p>
                    </div>
                    <Badge className="bg-accent/10 text-accent border-none text-xs font-black uppercase w-fit">
                      {job.status || "Scheduled"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-2xl space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm font-black text-primary uppercase">
                  No shifts scheduled yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Once dispatch assigns you to a move crew, your schedule will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}

