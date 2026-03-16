
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Truck, 
  Calendar, 
  Clock, 
  Star, 
  CheckCircle, 
  PlayCircle, 
  ShieldCheck, 
  BookOpen,
  AlertCircle,
  Megaphone
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy, limit, doc } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function EmployeeDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "announcements"), orderBy("createdAt", "desc"), limit(5));
  }, [firestore]);

  const { data: profile, isLoading } = useDoc(employeeRef);
  const { data: announcements, isLoading: announcementsLoading } = useCollection(announcementsQuery);

  if (isLoading) {
    return (
      <EmployeeLayout>
        <div className="p-20 text-center animate-pulse font-bold text-primary uppercase text-sm tracking-widest">
          Synchronizing Records...
        </div>
      </EmployeeLayout>
    );
  }

  const isTrainee = profile?.status === 'applicant' || profile?.status === 'training';

  return (
    <EmployeeLayout>
      <TooltipProvider>
        <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
          <header className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-primary uppercase leading-tight break-words">
              Welcome back, <span className="text-accent">{profile?.name || user?.displayName || "Teammate"}</span>
            </h1>
            <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {isTrainee ? "Training Mode | Account Pending Approval" : `Region: ${profile?.region || "National"} | ID: #${profile?.employeeId || "51-XXXX"}`}
            </p>
          </header>

          {isTrainee ? (
            /* --- TRAINING MODE UI --- */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="border-accent/20 bg-accent/5 shadow-none overflow-hidden">
                  <CardHeader className="bg-accent text-white py-4 sm:py-6">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      <CardTitle className="text-xs sm:text-sm font-black tracking-widest uppercase">ONBOARDING PROGRESS</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-8 space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] sm:text-xs font-black uppercase">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {[
                    { title: "Safety Protocol 101", duration: "12 min", status: "Completed", icon: ShieldCheck, color: "text-green-500" },
                    { title: "Customer Interaction", duration: "8 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                    { title: "Heavy Lifting Ergonomics", duration: "15 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                    { title: "Logistics App Guide", duration: "10 min", status: "Locked", icon: PlayCircle, color: "text-muted-foreground" },
                  ].map((video, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <Card className="border-none shadow-sm group cursor-pointer hover:border-accent transition-all border border-transparent overflow-hidden">
                          <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                            <div className={`p-3 rounded-xl bg-gray-50 shrink-0 ${video.color}`}>
                              <video.icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-primary text-sm sm:text-base group-hover:text-accent transition-colors truncate">{video.title}</p>
                              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest truncate">{video.duration} • {video.status}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-bold">{video.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <aside className="space-y-8">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-[10px] sm:text-xs font-black tracking-widest uppercase flex items-center gap-2">
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
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200'}`}>
                          {item.done && <CheckCircle className="h-3 w-3" />}
                        </div>
                        <span className={`text-sm font-bold truncate ${item.done ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-primary text-white border-none shadow-xl">
                  <CardContent className="p-6 space-y-4 text-center">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="font-black uppercase text-xs sm:text-sm tracking-widest">Application Status</h3>
                    <div className="bg-white/10 py-2 rounded-lg text-xs font-black text-accent uppercase">Under Review</div>
                    <p className="text-[10px] font-bold uppercase opacity-60">Estimated review: 48 Hours</p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : (
            /* --- ACTIVE EMPLOYEE UI --- */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { label: "Jobs This Month", value: profile?.stats?.jobs || "0", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Completed", value: profile?.stats?.completed || "0", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
                  { label: "Rating", value: profile?.stats?.rating || "5.0", icon: Star, color: "text-accent", bg: "bg-accent/10" },
                  { label: "Hours Logged", value: profile?.stats?.hours || "0", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
                ].map((stat, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Card className="border-none shadow-sm h-full hover:ring-1 hover:ring-accent/20 transition-all cursor-help">
                        <CardContent className="p-5 sm:p-6 flex items-center gap-4">
                          <div className={`p-3 rounded-xl shrink-0 ${stat.bg} ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">{stat.label}</p>
                            <p className="text-xl sm:text-2xl font-black text-primary truncate">{stat.value}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{stat.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm min-h-[300px]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 uppercase text-xs sm:text-sm font-black tracking-widest">
                      <Clock className="h-5 w-5 text-accent" />
                      TODAY'S SCHEDULE
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="p-12 text-center border-2 border-dashed rounded-3xl h-full flex flex-col justify-center bg-gray-50/50">
                      <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-primary uppercase text-sm">No jobs assigned for today</p>
                      <p className="text-xs text-muted-foreground mt-1">Assignments will appear here once dispatched.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="border-b border-gray-50">
                    <CardTitle className="flex items-center gap-2 uppercase text-xs sm:text-sm font-black tracking-widest">
                      <Megaphone className="h-5 w-5 text-accent" />
                      ANNOUNCEMENTS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-50">
                      {announcementsLoading ? (
                        <div className="p-10 text-center text-[10px] animate-pulse font-black text-muted-foreground uppercase tracking-widest">Syncing with Hub...</div>
                      ) : announcements && announcements.length > 0 ? (
                        announcements.map((ann) => (
                          <div key={ann.id} className="p-5 space-y-2 group hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black text-accent uppercase tracking-widest truncate">{ann.authorName || "Regional Hub"}</span>
                              <span className="text-[10px] text-muted-foreground font-bold uppercase shrink-0">
                                {ann.createdAt ? formatDistanceToNow(ann.createdAt.toDate(), { addSuffix: true }) : "Just now"}
                              </span>
                            </div>
                            <p className="text-sm font-black text-primary uppercase group-hover:text-accent transition-colors leading-tight break-words">{ann.title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">{ann.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-10 text-center text-xs text-muted-foreground italic">No active system broadcasts.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
    </EmployeeLayout>
  );
}
