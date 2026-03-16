"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  useCollection, 
  useMemoFirebase, 
  useFirestore 
} from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { 
  Search, 
  Truck, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  Package
} from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

type JobCategory = 'Scheduled' | 'Current' | 'Past';

function AdminJobsContent() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const jobsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "jobs"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    return query(collection(firestore, "users"));
  }, [firestore]);

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery);
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  const processedJobs = useMemo(() => {
    if (!jobs) return [];

    return jobs.map(job => {
      const customer = users?.find(u => u.id === job.customerId);
      
      let category: JobCategory = 'Current';
      const status = job.status?.toLowerCase();

      if (['completed', 'cancelled'].includes(status)) {
        category = 'Past';
      } else if (['scheduled', 'confirmed', 'new'].includes(status)) {
        category = 'Scheduled';
      } else {
        category = 'Current';
      }

      return {
        ...job,
        customerName: customer?.name || "Unknown Customer",
        category
      };
    });
  }, [jobs, users]);

  const filteredJobs = useMemo(() => {
    return processedJobs.filter(j => {
      const matchesSearch = 
        j.id.toLowerCase().includes(search.toLowerCase()) || 
        j.customerName.toLowerCase().includes(search.toLowerCase()) ||
        j.pickupAddress?.toLowerCase().includes(search.toLowerCase()) ||
        j.dropoffAddress?.toLowerCase().includes(search.toLowerCase());
      
      const matchesTab = activeTab === "all" || j.category.toLowerCase() === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [processedJobs, search, activeTab]);

  const stats = [
    { label: "Total Jobs", value: processedJobs.length, icon: Truck, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Scheduled", value: processedJobs.filter(j => j.category === 'Scheduled').length, icon: Calendar, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "In Progress", value: processedJobs.filter(j => j.category === 'Current').length, icon: Clock, color: "text-accent", bg: "bg-accent/5" },
    { label: "Completed", value: processedJobs.filter(j => j.category === 'Past' && j.status === 'completed').length, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
  ];

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return <Badge className="bg-green-500 hover:bg-green-500 uppercase text-[10px] font-black">Completed</Badge>;
    if (s === 'cancelled') return <Badge variant="destructive" className="uppercase text-[10px] font-black">Cancelled</Badge>;
    if (['scheduled', 'confirmed'].includes(s)) return <Badge className="bg-orange-500 hover:bg-orange-500 uppercase text-[10px] font-black">Scheduled</Badge>;
    return <Badge className="bg-accent hover:bg-accent uppercase text-[10px] font-black">{status}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-primary uppercase leading-tight">
          Nationwide <span className="text-accent">Job</span> Board
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Monitor logistics and move status across all 51 regions</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm h-full">
            <CardContent className="p-5 md:p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
              </div>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="text-2xl md:text-3xl font-black text-primary mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Job ID, Customer or Address..." 
              className="pl-10 h-12 bg-white border-gray-200 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            <Tabs defaultValue="all" className="w-full xl:w-auto" onValueChange={setActiveTab}>
              <TabsList className="bg-gray-100 p-1 rounded-xl h-12 inline-flex w-fit min-w-full xl:min-w-0">
                <TabsTrigger value="all" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">All Jobs</TabsTrigger>
                <TabsTrigger value="scheduled" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Scheduled</TabsTrigger>
                <TabsTrigger value="current" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Current</TabsTrigger>
                <TabsTrigger value="past" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Past</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0">
            {jobsLoading || usersLoading ? (
              <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
                Scanning Regional Logistics Hubs...
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all group gap-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-primary text-white rounded-2xl flex items-center justify-center shrink-0">
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-accent uppercase tracking-widest">ID: {job.id.slice(0, 8)}</span>
                          {getStatusBadge(job.status)}
                        </div>
                        <h3 className="font-bold text-primary text-base md:text-lg group-hover:text-accent transition-colors truncate">
                          {job.customerName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] md:text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5 shrink-0"><Calendar className="h-3.5 w-3.5 shrink-0" /> {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "Date TBD"}</span>
                          <span className="flex items-center gap-1.5 shrink-0"><MapPin className="h-3.5 w-3.5 shrink-0" /> {job.state}</span>
                          <span className="flex items-center gap-1.5 truncate"><Truck className="h-3.5 w-3.5 shrink-0" /> {job.pickupAddress?.split(',')[0]} → {job.dropoffAddress?.split(',')[0]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 pt-4 md:pt-0 border-t md:border-none">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Details</p>
                        <div className="flex gap-3 text-[11px] md:text-sm font-black text-primary">
                          <span className="capitalize">{job.moveSize} Move</span>
                          <span className="text-gray-200">|</span>
                          <span>${job.price?.toLocaleString()}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-white hover:shadow-md transition-all group-hover:translate-x-1 shrink-0">
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 md:p-20 text-center space-y-4">
                <div className="bg-gray-50 p-6 rounded-full w-fit mx-auto">
                  <Truck className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground opacity-20" />
                </div>
                <p className="font-bold text-primary">No jobs found matching your filters.</p>
                <Button 
                  variant="link" 
                  onClick={() => { setSearch(""); setActiveTab("all"); }} 
                  className="text-accent font-black uppercase text-xs"
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminJobsPage() {
  return (
    <EmployeeLayout isAdmin>
      <AdminJobsContent />
    </EmployeeLayout>
  );
}