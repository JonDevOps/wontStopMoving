
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
  Calculator, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import Link from "next/link";

function AdminQuotesContent() {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const quotesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "quotes"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: quotes, isLoading } = useCollection(quotesQuery);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    return quotes.filter(q => {
      const matchesSearch = 
        q.name?.toLowerCase().includes(search.toLowerCase()) || 
        q.email?.toLowerCase().includes(search.toLowerCase()) ||
        q.id.toLowerCase().includes(search.toLowerCase());
      
      const matchesTab = activeTab === "all" || q.status === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [quotes, search, activeTab]);

  const stats = [
    { label: "Total Estimates", value: quotes?.length || 0, icon: Calculator, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "New Requests", value: quotes?.filter(q => q.status === 'new').length || 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Processed", value: quotes?.filter(q => q.status === 'processed').length || 0, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    { label: "Expired", value: quotes?.filter(q => q.status === 'expired').length || 0, icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-100" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed': return <Badge className="bg-green-500 hover:bg-green-500 uppercase text-[10px] font-black">Processed</Badge>;
      case 'expired': return <Badge variant="secondary" className="uppercase text-[10px] font-black opacity-60">Expired</Badge>;
      default: return <Badge className="bg-orange-500 hover:bg-orange-500 uppercase text-[10px] font-black">New Request</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-primary uppercase leading-tight">
          Customer <span className="text-accent">Estimates</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Monitor and convert incoming service requests into jobs</p>
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
              placeholder="Search by name, email or ID..." 
              className="pl-10 h-12 bg-white border-gray-200 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            <Tabs defaultValue="all" className="w-full xl:w-auto" onValueChange={setActiveTab}>
              <TabsList className="bg-gray-100 p-1 rounded-xl h-12 inline-flex w-fit min-w-full xl:min-w-0">
                <TabsTrigger value="all" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">All Requests</TabsTrigger>
                <TabsTrigger value="new" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">New</TabsTrigger>
                <TabsTrigger value="processed" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Processed</TabsTrigger>
                <TabsTrigger value="expired" className="rounded-lg px-4 md:px-6 font-bold uppercase text-[10px] tracking-widest flex-1 xl:flex-none">Expired</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
                Scanning Estimating Database...
              </div>
            ) : filteredQuotes.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredQuotes.map((quote) => (
                  <Link key={quote.id} href={`/dashboard/admin/quotes/${quote.id}`} className="block">
                    <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all group gap-6">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/5 text-primary rounded-2xl flex items-center justify-center shrink-0">
                          <Calculator className="h-6 w-6" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-accent uppercase tracking-widest">EST: #{quote.id.slice(0, 8)}</span>
                            {getStatusBadge(quote.status)}
                          </div>
                          <h3 className="font-bold text-primary text-base md:text-lg group-hover:text-accent transition-colors truncate">
                            {quote.name || "Anonymous Request"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] md:text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1.5 shrink-0"><Calendar className="h-3.5 w-3.5 shrink-0" /> {quote.createdAt ? format(quote.createdAt.toDate(), "MMM d, yyyy") : "N/A"}</span>
                            <span className="flex items-center gap-1.5 shrink-0"><MapPin className="h-3.5 w-3.5 shrink-0" /> {quote.pickupZip || "N/A"} → {quote.dropoffZip || "N/A"}</span>
                            <span className="flex items-center gap-1.5 truncate capitalize font-black text-primary/60"><Calculator className="h-3.5 w-3.5 shrink-0" /> {quote.moveSize} Move</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 pt-4 md:pt-0 border-t md:border-none">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Inquiry Source</p>
                          <p className="text-[11px] md:text-sm font-black text-primary uppercase">
                            {quote.email}
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
                  <Calculator className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground opacity-20" />
                </div>
                <p className="font-bold text-primary">No estimates found matching your search.</p>
                <Button 
                  variant="link" 
                  onClick={() => { setSearch(""); setActiveTab("all"); }} 
                  className="text-accent font-black uppercase text-xs"
                >
                  Clear search
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminQuotesPage() {
  return (
    <EmployeeLayout isAdmin>
      <AdminQuotesContent />
    </EmployeeLayout>
  );
}
