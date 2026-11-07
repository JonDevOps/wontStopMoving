"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  Circle,
  PlayCircle,
  ShieldCheck,
  Megaphone,
  User,
  ShieldAlert,
  ArrowRight,
  PhoneCall,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from "@/firebase";
import { collection, query, orderBy, limit, doc } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TwoFactorCard } from "@/components/security/two-factor-card";

function EmployeeDashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "announcements"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
  }, [firestore, user]);

  const { data: userProfile, isLoading: isUserProfileLoading } =
    useDoc(userProfileRef);
  const { data: profile, isLoading: isEmployeeLoading } = useDoc(employeeRef);
  const { data: announcements, isLoading: announcementsLoading } =
    useCollection(announcementsQuery);

  if (isEmployeeLoading || isUserProfileLoading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-primary uppercase text-sm tracking-widest">
        Synchronizing Employee Dashboard...
      </div>
    );
  }

  const onboardingStep = profile?.onboardingStep || 2;
  const detailsDone = onboardingStep > 2;
  const idVerifiedDone =
    onboardingStep > 3 ||
    Boolean(profile?.verification?.selfie && profile?.verification?.idFront);
  const twoFactorDone = Boolean(userProfile?.twoFactorEnabled);

  const actionTasks = [
    {
      title: "1. Complete Your Operational Profile & Details",
      desc: "Add your physical location, vehicle details, and background check consent",
      done: detailsDone,
      href: "/careers/apply/details",
      cta: detailsDone ? "Edit Details" : "Complete Details",
      icon: User,
    },
    {
      title: "2. Submit ID Verification (Driver's License, Passport, State or Military ID)",
      desc: "Post-signup task — upload your ID & selfie whenever you're ready to unlock field dispatch",
      done: idVerifiedDone,
      href: "/careers/apply/verification",
      cta: idVerifiedDone ? "Update ID" : "Verify ID",
      icon: ShieldAlert,
    },
    {
      title: "3. Enable Two-Factor Authentication (2FA)",
      desc: "Post-signup security task — protect your employee account via SMS, Email, or Authenticator",
      done: twoFactorDone,
      href: "#two-factor-section",
      cta: twoFactorDone ? "Configured" : "Setup 2FA Below",
      icon: ShieldCheck,
    },
    {
      title: "4. Sales Call Script & Customer Qualification Checklist",
      desc: "Interactive call script & live move calculator for inbound and outbound sales calls",
      done: false,
      href: "/dashboard/employee/sales-script",
      cta: "Open Sales Script",
      icon: PhoneCall,
    },
  ];

  const completedTasksCount = [detailsDone, idVerifiedDone, twoFactorDone].filter(
    Boolean
  ).length;
  const readinessPercent = Math.round(((completedTasksCount + 1) / 4) * 100);

  const stats = [
    {
      label: "Assigned Moves",
      value: String(profile?.stats?.jobs || 0),
      sub: "This month's dispatch",
      icon: Truck,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Completed Jobs",
      value: String(profile?.stats?.completed || 0),
      sub: "Verified customer sign-offs",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      label: "Crew Rating",
      value: String(profile?.stats?.rating || "5.0"),
      sub: "Top-tier service score",
      icon: Star,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Readiness Score",
      value: `${readinessPercent}%`,
      sub: `${completedTasksCount + 1} of 4 setup tasks done`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header with Quick Actions */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-white border-none text-[10px] font-black uppercase tracking-widest">
              {profile?.status === "approved"
                ? "Active Field Crew"
                : "Onboarding & Operations"}
            </Badge>
            <span className="text-xs font-bold text-muted-foreground uppercase">
              Region: {userProfile?.state || profile?.state || "National"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-primary uppercase leading-tight">
            Welcome,{" "}
            <span className="text-accent">
              {userProfile?.name || "Teammate"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Your tasks, dispatch schedule, sales call playbook, and performance insights.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-accent hover:bg-accent/90 text-white rounded-full px-6 h-12 font-black uppercase tracking-wider text-xs gap-2 shadow-lg shadow-accent/20"
          >
            <Link href="/dashboard/employee/sales-script">
              <PhoneCall className="h-4 w-4" />
              Open Sales Call Script
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full px-6 h-12 font-black uppercase tracking-wider text-xs"
          >
            <Link href="/dashboard/employee/jobs">View My Jobs</Link>
          </Button>
        </div>
      </header>

      {/* Insights KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-black text-primary mt-0.5">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stat.sub}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Tasks & 2FA / Training Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                  <ListChecks className="h-5 w-5 text-accent" />
                  My Tasks & Post-Signup Checklist
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ID verification and 2FA can be completed anytime below without blocking your access.
                </p>
              </div>
              <Badge className="bg-primary text-white border-none text-xs font-black">
                {readinessPercent}% Ready
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={readinessPercent} className="h-2" />
              <div className="space-y-3 pt-2">
                {actionTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      task.done
                        ? "bg-green-50/50 border-green-200"
                        : "bg-slate-50/70 border-slate-100 hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {task.done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p
                          className={`font-black text-sm uppercase tracking-tight ${
                            task.done ? "text-green-900" : "text-primary"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {task.desc}
                        </p>
                      </div>
                    </div>
                    {task.href !== "#two-factor-section" && (
                      <Button
                        asChild
                        size="sm"
                        variant={task.done ? "outline" : "default"}
                        className={`rounded-xl font-bold text-xs uppercase shrink-0 ${
                          task.done
                            ? ""
                            : "bg-primary hover:bg-primary/90 text-white"
                        }`}
                      >
                        <Link href={task.href}>
                          {task.cta}
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div id="two-factor-section" className="pt-2">
                <TwoFactorCard userProfile={userProfile} compact />
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card className="border-none shadow-sm bg-white rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 uppercase text-xs sm:text-sm font-black tracking-widest">
                <Clock className="h-5 w-5 text-accent" />
                TODAY&apos;S DISPATCH SCHEDULE
              </CardTitle>
              <Link
                href="/dashboard/employee/calendar"
                className="text-xs font-bold text-accent hover:underline"
              >
                Open Full Calendar →
              </Link>
            </CardHeader>
            <CardContent className="p-6">
              <div className="p-10 text-center border-2 border-dashed rounded-2xl bg-gray-50/50 space-y-2">
                <Calendar className="h-9 w-9 text-muted-foreground mx-auto opacity-30" />
                <p className="font-bold text-primary uppercase text-sm">
                  No field jobs dispatched for today
                </p>
                <p className="text-xs text-muted-foreground">
                  While waiting for dispatch, you can use the Sales Call Script to qualify inbound moving leads.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Training Modules & Announcements */}
        <aside className="space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-accent" />
                Field & Sales Training Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { title: "Safety Protocol 101", duration: "12 min" },
                { title: "Customer Interaction & Sales", duration: "8 min" },
                { title: "Heavy Lifting Ergonomics", duration: "15 min" },
                { title: "Logistics App Guide", duration: "10 min" },
              ].map((mod, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-black text-primary uppercase">
                      {mod.title}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      {mod.duration} • Available Now
                    </p>
                  </div>
                  <Badge className="bg-accent/10 text-accent border-none text-[10px] font-black uppercase">
                    Ready
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-3xl">
            <CardHeader className="border-b border-gray-50">
              <CardTitle className="flex items-center gap-2 uppercase text-xs font-black tracking-widest">
                <Megaphone className="h-4 w-4 text-accent" />
                HUB ANNOUNCEMENTS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {announcementsLoading ? (
                  <div className="p-8 text-center text-xs animate-pulse font-bold text-muted-foreground">
                    Syncing with Hub...
                  </div>
                ) : announcements && announcements.length > 0 ? (
                  announcements.map((ann) => (
                    <div key={ann.id} className="p-5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                          {ann.authorName || "Wont Stop Moving"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">
                          {ann.createdAt?.toDate
                            ? formatDistanceToNow(ann.createdAt.toDate(), {
                                addSuffix: true,
                              })
                            : "Recent"}
                        </span>
                      </div>
                      <p className="text-sm font-black text-primary uppercase">
                        {ann.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No active broadcasts.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function EmployeeDashboard() {
  return (
    <EmployeeLayout>
      <EmployeeDashboardContent />
    </EmployeeLayout>
  );
}
