
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { FileText, ChevronRight, User, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AdminApplicationsPage() {
  const firestore = useFirestore();

  const appsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "applications"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: applications, isLoading } = useCollection(appsQuery);

  return (
    <EmployeeLayout isAdmin>
      <div className="space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">Job <span className="text-accent">Applications</span></h1>
          <p className="text-muted-foreground">Review and manage nationwide candidate profiles</p>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-black tracking-widest uppercase">ALL APPLICANTS ({applications?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-20 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-xs">
                Accessing Applicant Database...
              </div>
            ) : applications && applications.length > 0 ? (
              <div className="grid gap-4">
                {applications.map((app) => (
                  <Link key={app.id} href={`/dashboard/admin/applications/${app.id}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 rounded-2xl border border-transparent hover:border-accent/20 hover:bg-white transition-all group">
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-black">
                          {app.name?.[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-primary group-hover:text-accent transition-colors">{app.name}</h3>
                          <div className="flex items-center gap-4 text-[10px] uppercase font-black text-muted-foreground tracking-widest mt-1">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" /> {app.state}</span>
                            <span className="flex items-center gap-1"><User className="h-3 w-3 text-accent" /> {app.experience} Years Exp</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-accent" /> {app.createdAt ? format(app.createdAt.toDate(), "MMM d, yyyy") : "N/A"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-none pt-4 md:pt-0">
                        <Badge 
                          className={
                            app.status === 'approved' ? "bg-green-500" : 
                            app.status === 'rejected' ? "bg-red-500" : 
                            "bg-orange-500"
                          }
                        >
                          {app.status}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-all group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center border-2 border-dashed rounded-3xl">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="font-bold text-primary">No applications found.</p>
                <p className="text-sm text-muted-foreground">New applicant profiles will automatically appear here once submitted.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}
