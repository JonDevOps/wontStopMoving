"use client";

import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, orderBy } from "firebase/firestore";
import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Truck, 
  Calculator, 
  ChevronRight,
  TrendingUp,
  Package,
  User
} from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

function CustomerDetailContent({ id }: { id: string }) {
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "users", id);
  }, [firestore, id]);

  const { data: customer, isLoading: userLoading } = useDoc(userRef);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, "jobs"), where("customerId", "==", id), orderBy("createdAt", "desc"));
  }, [firestore, id]);

  const quotesQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, "quotes"), where("customerId", "==", id), orderBy("createdAt", "desc"));
  }, [firestore, id]);

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery);
  const { data: quotes, isLoading: quotesLoading } = useCollection(quotesQuery);

  if (userLoading) return <div className="p-20 text-center font-bold text-primary animate-pulse uppercase tracking-widest">Accessing Customer Records...</div>;
  if (!customer) return <div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Customer not found.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <Link href="/dashboard/admin/customers" className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center text-3xl font-black shrink-0 shadow-xl shadow-primary/10">
            {customer.name?.[0] || "C"}
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <Badge variant="outline" className="border-accent text-accent uppercase font-black text-[10px]">
                Customer Account
              </Badge>
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Member Since {customer.createdAt ? format(customer.createdAt.toDate(), "yyyy") : "2024"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-full border-primary text-primary font-bold px-6">Send Message</Button>
          <Button className="bg-accent hover:bg-accent/90 text-white rounded-full font-bold px-6">New Estimate</Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-4">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8 pt-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Mail className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Email Address</p>
                    <p className="font-bold text-primary">{customer.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><Phone className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Phone Number</p>
                    <p className="font-bold text-primary">{customer.phone || "Not Provided"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><MapPin className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Default Region</p>
                    <p className="font-bold text-primary">{customer.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><TrendingUp className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Last Login</p>
                    <p className="font-bold text-primary">Active Today</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-sm font-black tracking-widest uppercase">Move History ({jobs?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobsLoading ? (
                <div className="p-10 text-center animate-pulse text-xs font-bold text-muted-foreground uppercase">Syncing Jobs...</div>
              ) : jobs && jobs.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {jobs.map((job) => (
                    <Link key={job.id} href={`/dashboard/admin/jobs`}>
                      <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                          <div>
                            <p className="font-bold text-primary">{job.pickupAddress?.split(',')[0]} → {job.dropoffAddress?.split(',')[0]}</p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {job.moveDate ? format(new Date(job.moveDate), "MMM d, yyyy") : "Date TBD"} • ${job.price?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={job.status === 'completed' ? 'bg-green-500' : 'bg-accent'}>
                            {job.status}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Package className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-2" />
                  <p className="text-sm font-bold text-muted-foreground uppercase">No confirmed moves yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-primary">Requested Estimates ({quotes?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {quotesLoading ? (
                <div className="p-10 text-center animate-pulse text-xs font-bold text-muted-foreground uppercase">Syncing Quotes...</div>
              ) : quotes && quotes.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {quotes.map((quote) => (
                    <Link key={quote.id} href={`/dashboard/admin/quotes/${quote.id}`}>
                      <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg text-primary"><Calculator className="h-5 w-5" /></div>
                          <div>
                            <p className="font-bold text-primary capitalize">{quote.moveSize} Move Request</p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {quote.createdAt ? format(quote.createdAt.toDate(), "MMM d, yyyy") : "N/A"} • ID: {quote.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={quote.status === 'processed' ? 'border-green-500 text-green-500' : 'border-orange-500 text-orange-500'}>
                            {quote.status || 'new'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Calculator className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-2" />
                  <p className="text-sm font-bold text-muted-foreground uppercase">No quotes requested.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          <Card className="border-none shadow-sm bg-accent text-white">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase">Customer Value</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-sm font-bold opacity-80">Total Moves</span>
                <span className="text-2xl font-black">{jobs?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-sm font-bold opacity-80">Open Quotes</span>
                <span className="text-2xl font-black">{quotes?.filter(q => q.status === 'new').length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold opacity-80">Account Health</span>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-black">100%</span>
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
                <Calendar className="h-4 w-4 text-accent" />
                Schedule Consultation
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                <Calculator className="h-4 w-4 text-accent" />
                Override Pricing
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3 text-red-500 hover:bg-red-50 border-red-100">
                <User className="h-4 w-4 text-red-500" />
                Suspend Account
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <EmployeeLayout isAdmin>
      <CustomerDetailContent id={id} />
    </EmployeeLayout>
  );
}
