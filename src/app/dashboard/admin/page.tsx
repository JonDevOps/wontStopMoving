
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, FileText, TrendingUp, AlertCircle, ChevronRight, Megaphone, Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCollection, useMemoFirebase, useFirestore, addDocumentNonBlocking, useDoc, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function AdminDashboardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const appsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "applications"), orderBy("createdAt", "desc"), limit(5));
  }, [firestore]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, "users", authUser.uid);
  }, [firestore, authUser]);

  const { data: profile } = useDoc(userProfileRef);
  const { data: applications, isLoading } = useCollection(appsQuery);

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementContent) return;

    setIsSending(true);
    try {
      const announcementsRef = collection(firestore, "announcements");
      await addDocumentNonBlocking(announcementsRef, {
        title: announcementTitle,
        content: announcementContent,
        authorName: profile?.name || "Administrator",
        createdAt: serverTimestamp(),
        type: "system"
      });

      toast({
        title: "Announcement Broadcasted",
        description: "Your message is now live on all employee dashboards.",
      });

      setAnnouncementTitle("");
      setAnnouncementContent("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Broadcast Failed",
        description: "There was an error sending the announcement.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const kpis = [
    { label: "Total Revenue", value: "$42,850", trend: "+12.5%", icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Active Jobs", value: "32", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Unassigned", value: "8", icon: AlertCircle, color: "text-accent", bg: "bg-accent/10" },
    { label: "Employees", value: "51,000", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-primary uppercase">System <span className="text-accent">Overview</span></h1>
        <p className="text-muted-foreground">Nationwide Logistics Control Center</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
                {kpi.trend && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{kpi.trend}</span>
                )}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className="text-3xl font-black text-primary mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black tracking-widest uppercase">RECENT APPLICATIONS</CardTitle>
              <Link href="/dashboard/admin/careers" className="text-xs font-bold text-accent hover:underline">View All</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground animate-pulse">Scanning database...</div>
                ) : applications && applications.length > 0 ? (
                  applications.map((app) => (
                    <Link key={app.id} href={`/dashboard/admin/applications/${app.id}`}>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group mb-2 border border-transparent hover:border-accent/20">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                            {app.name?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-bold text-primary">{app.name}</p>
                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                              {app.state} • {app.experience} Years Exp • {app.createdAt ? format(app.createdAt.toDate(), "MMM d") : "Just now"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${app.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                            {app.status}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-bold text-primary">No applications received yet.</p>
                    <p className="text-xs text-muted-foreground">New applicant profiles will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary text-white flex flex-row items-center gap-2">
              <Megaphone className="h-5 w-5 text-accent" />
              <CardTitle className="text-sm font-black tracking-widest uppercase">System Broadcast</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Announcement Title" 
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="border-gray-200 h-12 font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Broadcast message to all 51,000 employees..." 
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="min-h-[120px] border-gray-200"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isSending || !announcementTitle || !announcementContent}
                    className="bg-accent hover:bg-accent/90 text-white rounded-full px-8 gap-2 font-bold uppercase tracking-widest text-xs h-12"
                  >
                    <Send className="h-4 w-4" />
                    {isSending ? "Broadcasting..." : "Send Announcement"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-black tracking-widest uppercase">REGIONAL CAPACITY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { state: "Texas", capacity: 85 },
                { state: "Ontario", capacity: 74 },
                { state: "California", capacity: 68 },
                { state: "British Columbia", capacity: 59 },
                { state: "Ohio", capacity: 42 },
                { state: "Puerto Rico", capacity: 25 },
              ].map((region, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>{region.state}</span>
                    <span className="text-accent">{region.capacity}%</span>
                  </div>
                  <Progress value={region.capacity} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <EmployeeLayout isAdmin>
      <AdminDashboardContent />
    </EmployeeLayout>
  );
}
