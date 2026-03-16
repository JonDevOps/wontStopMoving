
"use client";

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, IdCard, Calendar, ShieldCheck, Save, UserX } from "lucide-react";
import Link from "next/link";
import { useState, use, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ALL_LOCATIONS } from "@/lib/location-data";
import { format } from "date-fns";

function EmployeeDetailContent({ id }: { id: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "users", id);
  }, [firestore, id]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "employees", id);
  }, [firestore, id]);

  const { data: user, isLoading: userLoading } = useDoc(userRef);
  const { data: profile, isLoading: profileLoading } = useDoc(profileRef);

  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setRegion(profile.region || "Pending");
      setStatus(profile.status || "applicant");
    }
  }, [profile]);

  const handleUpdate = async () => {
    if (!profileRef) return;
    setIsSaving(true);
    try {
      await updateDoc(profileRef, {
        region,
        status,
      });
      toast({
        title: "Employee Updated",
        description: "Personnel records have been synchronized successfully.",
      });
    } catch (error: any) {
      console.error("Update Error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update employee status. Check permissions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading || profileLoading) return <div className="p-20 text-center font-bold text-primary animate-pulse uppercase tracking-widest">Accessing Personnel Records...</div>;
  if (!user || !profile) return <div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Employee profile not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <Link href="/dashboard/admin/employees" className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Team List
      </Link>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center text-3xl font-black shrink-0 shadow-xl shadow-primary/10">
            {user.name?.[0] || "E"}
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <Badge 
                className={
                  profile.status === 'active' ? "bg-green-500" : 
                  profile.status === 'rejected' ? "bg-red-500" : 
                  "bg-accent"
                }
              >
                {profile.status}
              </Badge>
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5" /> #{profile.employeeId || "UNASSIGNED"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-full border-primary text-primary font-bold px-6">System Logs</Button>
          <Button variant="ghost" className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 font-bold gap-2">
            <UserX className="h-4 w-4" /> Deactivate
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-4">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Contact & Identity</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 pt-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Mail className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Work Email</p>
                    <p className="font-bold text-primary">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Phone className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Phone Number</p>
                    <p className="font-bold text-primary">{user.phone || "Not Provided"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><MapPin className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Home State</p>
                    <p className="font-bold text-primary">{user.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Calendar className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Hire Date</p>
                    <p className="font-bold text-primary">
                      {profile.hireDate?.toDate ? format(profile.hireDate.toDate(), "MMMM d, yyyy") : "Pending Approval"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-sm font-black tracking-widest uppercase">Operational Deployment</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest">Assigned Service Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="h-12 border-gray-200 rounded-xl font-bold">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Awaiting Assignment</SelectItem>
                      {ALL_LOCATIONS.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Determines which job board items are visible to this employee.</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest">Employment Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-12 border-gray-200 rounded-xl font-bold">
                      <SelectValue placeholder="Set Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active Duty</SelectItem>
                      <SelectItem value="training">Training Phase</SelectItem>
                      <SelectItem value="applicant">New Applicant</SelectItem>
                      <SelectItem value="rejected">Inactive / Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Changing to 'Active Duty' grants access to live customer logistics.</p>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-50 pt-6">
                <Button 
                  onClick={handleUpdate} 
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent/90 text-white rounded-xl px-10 h-12 font-bold uppercase tracking-widest text-xs gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Updating Records..." : "Save Deployment Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          <Card className="border-none shadow-sm bg-accent text-white">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase">Performance Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold opacity-80">Jobs Completed</span>
                <span className="text-2xl font-black">{profile.assignedJobIds?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold opacity-80">System Rating</span>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-black">5.0</span>
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase text-primary">Admin Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                <Briefcase className="h-4 w-4 text-accent" />
                View Assigned Jobs
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                <Calendar className="h-4 w-4 text-accent" />
                Review Timesheets
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Background Check Results
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function EmployeeManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <EmployeeLayout isAdmin>
      <EmployeeDetailContent id={id} />
    </EmployeeLayout>
  );
}
