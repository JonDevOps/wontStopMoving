"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  FileText,
  Calendar,
  ArrowRight,
  Package,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import {
  useCollection,
  useDoc,
  useMemoFirebase,
  useUser,
  useFirestore,
} from "@/firebase";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TwoFactorCard } from "@/components/security/two-factor-card";
import { multiFactor } from 'firebase/auth';

function CustomerDashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const quotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "quotes"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
  }, [firestore, user]);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "jobs"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userProfileRef);
  const { data: quotes, isLoading: quotesLoading } = useCollection(quotesQuery);
  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery);

  const hasQuotes = Boolean(quotes && quotes.length > 0);
  const hasJobs = Boolean(jobs && jobs.length > 0);
  const completedJobs =
    jobs?.filter((j) => j.status === "completed").length || 0;
  const has2FA = Boolean(user && multiFactor(user).enrolledFactors.length);
  const hasPhone = Boolean(userProfile?.phone);

  const customerTasks = [
    {
      title: "Request Your Free Move Quote",
      desc: "Get an instant flat-rate estimate for your upcoming move",
      done: hasQuotes || hasJobs,
      href: "/quote",
      cta: "Get Quote",
    },
    {
      title: "Book & Reserve Your Moving Crew",
      desc: "Compare vetted marketplace providers and lock in your move date",
      done: hasJobs,
      href: "/book",
      cta: "Book Now",
    },
    {
      title: "Add Phone & Contact Preferences",
      desc: "Ensure your dispatch coordinator can reach you on move day",
      done: hasPhone,
      href: "/dashboard/customer/profile",
      cta: "Update Profile",
    },
    {
      title: "Enable Two-Factor Authentication (2FA)",
      desc: "Optional security task — protect your move bookings and payments",
      done: has2FA,
      href: "#security",
      cta: "Configure Below",
    },
  ];

  const completedTasksCount = customerTasks.filter((t) => t.done).length;
  const readinessPercent = Math.round(
    (completedTasksCount / customerTasks.length) * 100
  );

  const stats = [
    {
      label: "Active Moves",
      value: String(jobs?.length || 0),
      sub: hasJobs ? "Crew assigned & tracked" : "Ready to schedule",
      icon: Truck,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Saved Quotes",
      value: String(quotes?.length || 0),
      sub: hasQuotes ? "Locked-in flat rates" : "Request a free estimate",
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Completed Moves",
      value: String(completedJobs),
      sub: "Escrow-protected relocations",
      icon: Package,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      label: "Move Readiness",
      value: `${readinessPercent}%`,
      sub: `${completedTasksCount} of ${customerTasks.length} tasks done`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Badge className="bg-accent/10 text-accent border-none text-[10px] font-black uppercase tracking-widest mb-2">
            Customer Command Center
          </Badge>
          <h1 className="text-3xl font-black text-primary uppercase">
            Move <span className="text-accent">Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Track your tasks, quotes, and upcoming relocations in one place
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="rounded-full bg-accent hover:bg-accent/90 px-8 h-12 font-bold uppercase tracking-wider shadow-lg shadow-accent/20 transition-all"
          >
            <Link href="/book">Book a Move</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-accent text-accent hover:bg-accent hover:text-white px-8 h-12 font-bold uppercase tracking-wider transition-all"
          >
            <Link href="/quote">Request New Quote</Link>
          </Button>
        </div>
      </header>

      {/* Insights KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-black text-primary mt-0.5">
                  {stat.value}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {stat.sub}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My Move Tasks & Insights Row */}
      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <ListChecks className="h-4 w-4 text-accent" />
                Your Next Steps & Tasks
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Complete these quick tasks at your own pace for a smooth move day.
              </p>
            </div>
            <Badge className="bg-primary text-white border-none text-xs font-black">
              {completedTasksCount}/{customerTasks.length} Done
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={readinessPercent} className="h-2" />
            <div className="space-y-3 pt-2">
              {customerTasks.map((task, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    task.done
                      ? "bg-green-50/50 border-green-200"
                      : "bg-slate-50/70 border-slate-100 hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {task.done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p
                        className={`font-black text-sm uppercase tracking-tight ${
                          task.done
                            ? "line-through text-green-800"
                            : "text-primary"
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.desc}
                      </p>
                    </div>
                  </div>
                  {!task.done && task.href !== "#security" && (
                    <Button
                      asChild
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs uppercase shrink-0"
                    >
                      <Link href={task.href}>{task.cta}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Smart Move Insights & 2FA Security Card */}
        <div className="space-y-6" id="security">
          <Card className="border-none shadow-sm bg-primary text-white rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-accent text-xs font-black uppercase tracking-widest">
                <Sparkles className="h-4 w-4" />
                Smart Move Insight
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">
                Save 5%–15% by Booking Early
              </h3>
              <p className="text-xs text-white/80 leading-relaxed">
                Mid-week moves (Tuesday–Thursday) have the highest crew availability. Remember: your payment is held in escrow until your move is completed!
              </p>
            </CardContent>
          </Card>

          <TwoFactorCard userProfile={userProfile} />
        </div>
      </div>

      {/* Active Moves & Recent Quotes */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" />
              Active Moves
            </CardTitle>
            <Link
              href="/dashboard/customer/moves"
              className="text-xs font-bold text-accent hover:underline"
            >
              See All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading moves...
                </div>
              ) : jobs && jobs.length > 0 ? (
                jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/customer/moves/${job.id}`}
                    className="block p-4 bg-gray-50 rounded-xl border border-transparent hover:border-accent transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-accent uppercase mb-1">
                          #{job.id.slice(0, 8)}
                        </p>
                        <p className="font-bold text-primary">
                          {job.pickupAddress?.split(",")[0] || "Origin"} to{" "}
                          {job.dropoffAddress?.split(",")[0] || "Destination"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" /> Scheduled for{" "}
                          {job.moveDate || "TBD"}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">
                        {job.status}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-10 text-center border-2 border-dashed rounded-2xl space-y-2">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-bold text-primary">
                    No active moves yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Book a move from our vetted marketplace providers to track it here.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              Recent Quotes
            </CardTitle>
            <Link
              href="/dashboard/customer/quotes"
              className="text-xs font-bold text-accent hover:underline"
            >
              See All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quotesLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading quotes...
                </div>
              ) : quotes && quotes.length > 0 ? (
                quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href="/dashboard/customer/quotes"
                    className="p-4 bg-gray-50 rounded-xl flex items-center justify-between group cursor-pointer border border-transparent hover:border-accent transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg text-primary shadow-sm">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-primary uppercase text-sm">
                          {quote.moveSize} Move
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested{" "}
                          {quote.createdAt?.toDate
                            ? new Date(
                                quote.createdAt.toDate()
                              ).toLocaleDateString()
                            : "Recently"}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </Link>
                ))
              ) : (
                <div className="p-10 text-center border-2 border-dashed rounded-2xl space-y-2">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-bold text-primary">
                    No quotes requested yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Request your first free quote to compare options!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  return (
    <CustomerLayout>
      <CustomerDashboardContent />
    </CustomerLayout>
  );
}
