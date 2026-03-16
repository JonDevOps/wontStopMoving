
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, ChevronRight, Truck, Lock } from "lucide-react";
import Link from "next/link";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

function EmployeeJobsContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc(employeeRef);

  if (isLoading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-primary uppercase text-sm">Validating Access...</div>
    );
  }

  const isActive = profile?.status === 'active';

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase">My Assigned <span className="text-accent">Jobs</span></h1>
          <p className="text-muted-foreground">Manage your current and upcoming assignments</p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full bg-white border-gray-200">Active</Button>
            <Button variant="ghost" className="rounded-full">History</Button>
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
              <Link href="/dashboard/employee">Go to Training Portal</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ACTIVE JOBS LIST */
        <div className="grid gap-4">
          <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-white">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-primary uppercase">Ready for Dispatch</h3>
            <p className="text-sm text-muted-foreground mb-6">You don't have any jobs assigned at the moment.</p>
            <Button variant="outline" className="rounded-full">Request Assignment</Button>
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
