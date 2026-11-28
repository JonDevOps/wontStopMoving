"use client";
import { moveDay } from "@/lib/move-details";

import { useAuth, useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { apiFetch } from "@/lib/api-client";
import { useAccountActivity } from "@/hooks/use-account-activity";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { use, useEffect, useState } from "react";
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
  const auth = useAuth();
  const { toast } = useToast();
  const { accounts } = useAccountActivity(id ? [id] : []);
  const [suspendOverride, setSuspendOverride] = useState<boolean | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  // Sales calls about this customer, with their answers to the script (#123).
  const [calls, setCalls] = useState<{ id: string; createdAt: string | null; repName: string; disposition: string; notes: string; answers: Record<string, { label: string; answer: string }> }[] | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiFetch<{ calls: NonNullable<typeof calls> }>(auth, `/api/sales/calls?lookup=1&customerId=${encodeURIComponent(id)}`)
      .then(r => { if (!cancelled) setCalls(r.calls); })
      .catch(() => { if (!cancelled) setCalls([]); });
    return () => { cancelled = true; };
  }, [auth, id]);

  if (userLoading) return <div className="p-20 text-center font-bold text-primary animate-pulse uppercase tracking-widest">Accessing Customer Records...</div>;
  if (!customer) return <div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Customer not found.</div>;

  const suspended = suspendOverride ?? Boolean(customer.suspended);
  const lastSignIn = accounts[id]?.lastSignInAt;
  const openQuote = quotes?.find((q: any) => !q.status || q.status === 'new') || quotes?.[0];
  // Prefilled Google Calendar invite with the customer as a guest (#109).
  const consultationHref = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: `Moving consultation: ${customer.name || customer.email || 'Customer'}`,
    details: `Wont Stop Moving consultation.\nCustomer phone: ${customer.phone || 'not provided'}`,
    ...(customer.email ? { add: customer.email } : {}),
  }).toString()}`;

  async function setAccountSuspended(next: boolean) {
    setSavingStatus(true);
    try {
      await apiFetch(auth, '/api/admin/account-status', { uid: id, suspended: next });
      setSuspendOverride(next);
      toast({ title: next ? 'Account suspended' : 'Account reinstated', description: next ? 'They have been signed out and cannot sign in.' : 'They can sign in again.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update the account', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setSavingStatus(false);
    }
  }

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
                {customer.role && customer.role !== "customer" ? `${customer.role} account` : "Customer Account"}
              </Badge>
              {suspended && <Badge className="bg-red-500 uppercase font-black text-[10px]">Suspended</Badge>}
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Member Since {customer.createdAt ? format(customer.createdAt.toDate(), "yyyy") : "2024"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="rounded-full border-primary text-primary font-bold px-6" disabled={!customer.email}>
            <a href={customer.email ? `mailto:${customer.email}` : undefined}>Send Message</a>
          </Button>
          <Button asChild className="bg-accent hover:bg-accent/90 text-white rounded-full font-bold px-6">
            <Link href={`/dashboard/admin/quotes/new?${new URLSearchParams({ name: customer.name || "", email: customer.email || "" }).toString()}`}>New Estimate</Link>
          </Button>
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
                    <p className="font-bold text-primary">{customer.state || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-primary"><TrendingUp className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Last Login</p>
                    <p className="font-bold text-primary">{lastSignIn ? format(new Date(lastSignIn), "MMM d, yyyy h:mm a") : "Not recorded"}</p>
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
                    <Link key={job.id} href={`/dashboard/admin/jobs/${job.id}`}>
                      <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                          <div>
                            <p className="font-bold text-primary">{job.pickupAddress?.split(',')[0]} → {job.dropoffAddress?.split(',')[0]}</p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {job.moveDate ? format(moveDay(job.moveDate), "MMM d, yyyy") : "Date TBD"} • ${job.price?.toLocaleString()}
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

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-sm font-black tracking-widest uppercase text-primary">Call notes ({calls?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {calls === null ? <p className="text-xs font-bold text-muted-foreground uppercase animate-pulse">Loading calls…</p> : calls.length === 0 ? <p className="text-sm text-muted-foreground">No sales calls logged for this customer yet.</p> : (
                <ul className="space-y-4">{calls.map(c => (
                  <li key={c.id} className="border-l-2 border-accent pl-3 space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{c.createdAt ? format(new Date(c.createdAt), "MMM d, yyyy h:mm a") : ""} · {c.disposition} · {c.repName}</p>
                    {c.notes && <p className="text-sm whitespace-pre-wrap">{c.notes}</p>}
                    {Object.values(c.answers || {}).map((a, i) => <p key={i} className="text-sm"><span className="font-bold">{a.label}:</span> {a.answer}</p>)}
                  </li>
                ))}</ul>
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
                <span className="text-sm font-bold opacity-80">Completed Moves</span>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-black">{jobs?.filter((j: any) => j.status === 'completed').length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xs font-black tracking-widest uppercase text-primary">Admin Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                <a href={consultationHref} target="_blank" rel="noopener noreferrer">
                  <Calendar className="h-4 w-4 text-accent" />
                  Schedule Consultation
                </a>
              </Button>
              {openQuote ? (
                <Button asChild variant="outline" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                  <Link href={`/dashboard/admin/quotes/${openQuote.id}`}>
                    <Calculator className="h-4 w-4 text-accent" />
                    Override Pricing
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" disabled title="This customer has no quotes to reprice" className="w-full justify-start rounded-xl font-bold text-xs py-6 gap-3">
                  <Calculator className="h-4 w-4 text-accent" />
                  Override Pricing (no quotes)
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={savingStatus} className={suspended ? "w-full justify-start rounded-xl font-bold text-xs py-6 gap-3 text-green-600 hover:bg-green-50 border-green-100" : "w-full justify-start rounded-xl font-bold text-xs py-6 gap-3 text-red-500 hover:bg-red-50 border-red-100"}>
                    <User className={suspended ? "h-4 w-4 text-green-600" : "h-4 w-4 text-red-500"} />
                    {suspended ? "Reinstate Account" : "Suspend Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{suspended ? "Reinstate this account?" : "Suspend this account?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {suspended
                        ? `${customer.name || "This customer"} will be able to sign in again.`
                        : `${customer.name || "This customer"} will be signed out everywhere and blocked from signing in until you reinstate them. Their moves and quotes are kept.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setAccountSuspended(!suspended)}>
                      {suspended ? "Reinstate" : "Suspend"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
