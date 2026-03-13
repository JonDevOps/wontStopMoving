
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Truck, 
  Calendar, 
  Clock, 
  Star, 
  TrendingUp, 
  CheckCircle, 
  PlayCircle, 
  ShieldCheck, 
  BookOpen,
  AlertCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

export default function EmployeeDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc(employeeRef);

  if (isLoading) {
    return (
      <EmployeeLayout>
        <div className="p-20 text-center animate-pulse font-bold text-primary uppercase">Loading Profile...</div>
      </EmployeeLayout>
    );
  }

  const isTrainee = profile?.status === 'applicant' || profile?.status === 'training';

  return (
    <EmployeeLayout>
      <div className="space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">
            Welcome back, <span className="text-accent">{profile?.name || user?.displayName || "Teammate"}</span>
          </h1>
          <p className="text-muted-foreground">
            {isTrainee ? "Training Mode | Account Pending Approval" : `Region: ${profile?.region || "National"} | ID: #${profile?.employeeId || "51-XXXX"}`}
          </p>
        </header>

        {isTrainee ? (
          /* --- TRAINING MODE UI --- */
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-accent/20 bg-accent/5 shadow-none overflow-hidden">
                <CardHeader className="bg-accent text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    <CardTitle className="text-sm font-black tracking-widest uppercase">ONBOARDING PROGRESS</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase">
                      <span className="text-primary">Phase 1: Basic Certification</span>
                      <span className="text-accent">25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Welcome to the team! While our HR department reviews your application, please complete the initial training modules below. This will prepare you for your first day on the field once approved.
                  </p>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: "Safety Protocol 101", duration: "12 min", status: "Completed", icon: ShieldCheck, color: "text-green-500" },
                  { title: "Customer Interaction", duration: "8 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                  { title: "Heavy Lifting Ergonomics", duration: "15 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                  { title: "Logistics App Guide", duration: "10 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                ].map((video, i) => (
                  <Card key={i} className="border-none shadow-sm group cursor-pointer hover:border-accent transition-all border border-transparent">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className={`p-3 rounded-xl bg-gray-50 ${video.color}`}>
                        <video.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-primary text-sm group-hover:text-accent transition-colors">{video.title}</p>
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{video.duration} • {video.status}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <aside className="space-y-8">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs font-black tracking-widest uppercase flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-accent" />
                    CHECKLIST
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Profile Setup", done: true },
                    { label: "Safety Quiz", done: false },
                    { label: "Upload ID", done: false },
                    { label: "Background Consent", done: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200'}`}>
                        {item.done && <CheckCircle className="h-3 w-3" />}
                      </div>
                      <span className={`text-sm font-bold ${item.done ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-primary text-white border-none shadow-xl">
                <CardContent className="p-6 space-y-4 text-center">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-bold uppercase text-sm">Application Status</h3>
                  <div className="bg-white/10 py-2 rounded-lg text-xs font-bold text-accent uppercase">Under Review</div>
                  <p className="text-[10px] opacity-60">Most reviews are completed within 48 business hours.</p>
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : (
          /* --- ACTIVE EMPLOYEE UI --- */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Jobs This Month", value: profile?.stats?.jobs || "0", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Completed", value: profile?.stats?.completed || "0", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Rating", value: profile?.stats?.rating || "5.0", icon: Star, color: "text-accent", bg: "bg-accent/10" },
                { label: "Hours Logged", value: profile?.stats?.hours || "0", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
              ].map((stat, i) => (
                <Card key={i} className="border-none shadow-sm">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-black text-primary">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 uppercase text-sm font-black tracking-widest">
                    <Clock className="h-5 w-5 text-accent" />
                    TODAY'S SCHEDULE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl">
                    <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="font-bold text-primary">No jobs assigned for today.</p>
                    <p className="text-xs text-muted-foreground">Check the jobs tab for upcoming assignments.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 uppercase text-sm font-black tracking-widest">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    ANNOUNCEMENTS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Regional Hub</span>
                        <span className="text-[10px] text-muted-foreground">Just now</span>
                      </div>
                      <p className="text-sm font-bold text-primary">System Update Complete</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">Full logistics tracking is now enabled for all regional moves.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </EmployeeLayout>
  );
}
