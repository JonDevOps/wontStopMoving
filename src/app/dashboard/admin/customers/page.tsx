
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
import { collection, query, where, orderBy } from "firebase/firestore";
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ChevronRight, 
  Filter,
  History,
  TrendingUp,
  Star,
  Users
} from "lucide-react";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CustomerCategory = 'Potential' | 'Current' | 'Past' | 'Repeat';

interface CustomerWithStats {
  id: string;
  name: string;
  email: string;
  phone?: string;
  state: string;
  category: CustomerCategory;
  activeJobsCount: number;
  completedJobsCount: number;
  totalJobsCount: number;
}

export default function AdminCustomersPage() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch all users with role 'customer'
  const customersQuery = useMemoFirebase(() => {
    return query(collection(firestore, "users"), where("role", "==", "customer"));
  }, [firestore]);

  // Fetch all jobs to calculate statistics
  const jobsQuery = useMemoFirebase(() => {
    return query(collection(firestore, "jobs"));
  }, [firestore]);

  const { data: rawCustomers, isLoading: customersLoading } = useCollection(customersQuery);
  const { data: allJobs, isLoading: jobsLoading } = useCollection(jobsQuery);

  // Process data to calculate categories and stats
  const customers = useMemo(() => {
    if (!rawCustomers || !allJobs) return [];

    return rawCustomers.map((user) => {
      const userJobs = allJobs.filter(job => job.customerId === user.id);
      const activeJobs = userJobs.filter(job => !['completed', 'cancelled'].includes(job.status));
      const completedJobs = userJobs.filter(job => job.status === 'completed');

      const activeCount = activeJobs.length;
      const completedCount = completedJobs.length;

      let category: CustomerCategory = 'Potential';
      
      if (activeCount > 0) {
        category = 'Current';
      } else if (completedCount > 1) {
        category = 'Repeat';
      } else if (completedCount === 1) {
        category = 'Past';
      }

      return {
        ...user,
        category,
        activeJobsCount: activeCount,
        completedJobsCount: completedCount,
        totalJobsCount: userJobs.length,
      } as CustomerWithStats;
    });
  }, [rawCustomers, allJobs]);

  // Filter based on search and tab
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesTab = activeTab === "all" || c.category.toLowerCase() === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [customers, search, activeTab]);

  const stats = [
    { label: "Total Customers", value: customers.length, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Current", value: customers.filter(c => c.category === 'Current').length, icon: TrendingUp, color: "text-green-500", bg: "bg-green-50" },
    { label: "Repeat", value: customers.filter(c => c.category === 'Repeat').length, icon: Star, color: "text-accent", bg: "bg-accent/5" },
    { label: "Potential", value: customers.filter(c => c.category === 'Potential').length, icon: User, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  const getCategoryBadge = (category: CustomerCategory) => {
    switch (category) {
      case 'Current': return <Badge className="bg-green-500 hover:bg-green-500 uppercase text-[10px] font-black">Current</Badge>;
      case 'Repeat': return <Badge className="bg-accent hover:bg-accent uppercase text-[10px] font-black">Repeat Customer</Badge>;
      case 'Past': return <Badge className="bg-blue-500 hover:bg-blue-500 uppercase text-[10px] font-black">Past Customer</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground uppercase text-[10px] font-black border-gray-200">Potential</Badge>;
    }
  };

  return (
    <EmployeeLayout isAdmin>
      <div className="space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">Customer <span className="text-accent">Relationship</span> Manager</h1>
          <p className="text-muted-foreground">Manage accounts and track lifecycle value across 51 regions</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-black text-primary mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name or email..." 
                className="pl-10 h-12 bg-white border-gray-200 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs defaultValue="all" className="w-full md:w-auto" onValueChange={setActiveTab}>
              <TabsList className="bg-gray-100 p-1 rounded-xl h-12">
                <TabsTrigger value="all" className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">All</TabsTrigger>
                <TabsTrigger value="current" className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">Current</TabsTrigger>
                <TabsTrigger value="repeat" className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">Repeat</TabsTrigger>
                <TabsTrigger value="past" className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">Past</TabsTrigger>
                <TabsTrigger value="potential" className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">Potential</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {customersLoading || jobsLoading ? (
                <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
                  Analyzing Customer Database...
                </div>
              ) : filteredCustomers.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all group">
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center text-xl font-black shrink-0">
                          {customer.name?.[0] || "C"}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-primary text-lg group-hover:text-accent transition-colors">{customer.name}</h3>
                            {getCategoryBadge(customer.category)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {customer.email}</span>
                            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone}</span>}
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {customer.state}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Move History</p>
                          <div className="flex gap-3 text-sm font-black text-primary">
                            <span title="Active Jobs">{customer.activeJobsCount} Active</span>
                            <span className="text-gray-200">|</span>
                            <span title="Completed Jobs">{customer.completedJobsCount} Finished</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white hover:shadow-md transition-all group-hover:translate-x-1">
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center space-y-4">
                  <div className="bg-gray-50 p-6 rounded-full w-fit mx-auto">
                    <User className="h-12 w-12 text-muted-foreground opacity-20" />
                  </div>
                  <p className="font-bold text-primary">No customers found matching your filters.</p>
                  <Button variant="link" onClick={() => { setSearch(""); setActiveTab("all"); }} className="text-accent font-black uppercase text-xs">Clear all filters</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
