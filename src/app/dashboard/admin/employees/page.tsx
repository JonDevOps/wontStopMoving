
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
import { collection, query, where } from "firebase/firestore";
import { 
  Search, 
  ShieldCheck, 
  User, 
  Mail, 
  MapPin, 
  ChevronRight, 
  Users,
  GraduationCap,
  Briefcase,
  IdCard
} from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

type EmployeeStatus = 'active' | 'training' | 'applicant' | 'rejected';

interface CombinedEmployee {
  id: string;
  name: string;
  email: string;
  state: string;
  employeeId?: string;
  status: EmployeeStatus;
  region?: string;
  hireDate?: any;
}

function AdminEmployeesContent() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const usersQuery = useMemoFirebase(() => {
    return query(collection(firestore, "users"), where("role", "==", "employee"));
  }, [firestore]);

  const profilesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "employees"));
  }, [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
  const { data: profiles, isLoading: profilesLoading } = useCollection(profilesQuery);

  const employees = useMemo(() => {
    if (!users || !profiles) return [];

    return users.map((user) => {
      const profile = profiles.find(p => p.id === user.id);
      return {
        id: user.id,
        name: user.name || "Unknown",
        email: user.email,
        state: user.state || "N/A",
        employeeId: profile?.employeeId,
        status: (profile?.status || 'applicant') as EmployeeStatus,
        region: profile?.region || "Pending",
        hireDate: profile?.hireDate,
      } as CombinedEmployee;
    });
  }, [users, profiles]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesSearch = 
        e.name.toLowerCase().includes(search.toLowerCase()) || 
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeId?.toLowerCase().includes(search.toLowerCase());
      
      const matchesTab = activeTab === "all" || e.status === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [employees, search, activeTab]);

  const stats = [
    { label: "Total Team", value: employees.length, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Active Field", value: employees.filter(e => e.status === 'active').length, icon: Briefcase, color: "text-green-500", bg: "bg-green-50" },
    { label: "In Training", value: employees.filter(e => e.status === 'training').length, icon: GraduationCap, color: "text-accent", bg: "bg-accent/5" },
    { label: "New Applicants", value: employees.filter(e => e.status === 'applicant').length, icon: User, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500 hover:bg-green-500 uppercase text-[10px] font-black">Active Duty</Badge>;
      case 'training': return <Badge className="bg-accent hover:bg-accent uppercase text-[10px] font-black">Training</Badge>;
      case 'applicant': return <Badge variant="secondary" className="uppercase text-[10px] font-black">Applicant</Badge>;
      case 'rejected': return <Badge variant="destructive" className="uppercase text-[10px] font-black">Inactive</Badge>;
      default: return <Badge variant="outline" className="uppercase text-[10px] font-black">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-primary uppercase leading-tight">
          Workforce <span className="text-accent">Management</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Monitor and manage 51,000 professionals across 51 regions</p>
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
              <p className="text-2xl md:text-3xl font-black text-primary mt-1">{stat.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search name, email or ID..." 
              className="pl-10 h-12 bg-white border-gray-200 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            <Tabs defaultValue="all" className="w-full xl:w-auto" onValueChange={setActiveTab}>
              <TabsList className="bg-gray-100 p-1 rounded-xl h-12 inline-flex w-fit min-w-full xl:min-w-0">
                <TabsTrigger value="all" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">All Team</TabsTrigger>
                <TabsTrigger value="active" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Active</TabsTrigger>
                <TabsTrigger value="training" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Training</TabsTrigger>
                <TabsTrigger value="applicant" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Applicants</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0">
            {usersLoading || profilesLoading ? (
              <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
                Accessing Secure Personnel Records...
              </div>
            ) : filteredEmployees.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredEmployees.map((employee) => (
                  <Link key={employee.id} href={`/dashboard/admin/employees/${employee.id}`} className="block">
                    <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all group gap-4">
                      <div className="flex items-start md:items-center gap-4 flex-1">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-primary text-white rounded-2xl flex items-center justify-center text-lg md:text-xl font-black shrink-0 relative">
                          {employee.name?.[0] || "E"}
                          {employee.status === 'active' && (
                            <div className="absolute -top-1 -right-1 bg-green-500 border-2 border-white w-4 h-4 rounded-full" />
                          )}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-primary text-base md:text-lg group-hover:text-accent transition-colors truncate">
                              {employee.name}
                            </h3>
                            {getStatusBadge(employee.status)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] md:text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1.5 min-w-0 truncate"><Mail className="h-3 w-3 shrink-0" /> {employee.email}</span>
                            <span className="flex items-center gap-1.5 shrink-0"><IdCard className="h-3 w-3 shrink-0" /> {employee.employeeId || "No ID Assigned"}</span>
                            <span className="flex items-center gap-1.5 shrink-0"><MapPin className="h-3 w-3 shrink-0" /> {employee.state} ({employee.region})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 pt-4 md:pt-0 border-t md:border-none">
                        <div className="text-left md:text-right hidden sm:block">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Regional Assignment</p>
                          <p className="text-[11px] md:text-sm font-black text-primary uppercase">
                            {employee.region === 'Pending' ? 'Awaiting Dispatch' : employee.region}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white hover:shadow-md transition-all group-hover:translate-x-1 shrink-0">
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 md:p-20 text-center space-y-4">
                <div className="bg-gray-50 p-6 rounded-full w-fit mx-auto">
                  <ShieldCheck className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground opacity-20" />
                </div>
                <p className="font-bold text-primary">No team members found matching your search.</p>
                <Button 
                  variant="link" 
                  onClick={() => { setSearch(""); setActiveTab("all"); }} 
                  className="text-accent font-black uppercase text-xs"
                >
                  Reset view
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminEmployeesPage() {
  return (
    <EmployeeLayout isAdmin>
      <AdminEmployeesContent />
    </EmployeeLayout>
  );
}
