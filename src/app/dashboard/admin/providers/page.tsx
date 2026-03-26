"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCheck, ShieldAlert, FileText, CheckCircle2, Clock, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function ProviderManagementContent() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const providersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "providers"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: providers, isLoading } = useCollection(providersQuery);

  const updateStatus = async (providerId: string, newStatus: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "providers", providerId), {
        status: newStatus
      });
      toast({
        title: "Status Updated",
        description: `Provider status changed to ${newStatus}.`,
      });
      
      // Also update users collection if we approve them so they can login smoothly
      // Wait, we don't necessarily need to touch the users doc if the Role is already provider,
      // but if we want to ensure data coherence we might. For now, updating 'providers' doc is enough.
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-primary uppercase">Provider <span className="text-accent">Approvals</span></h1>
        <p className="text-muted-foreground">Manage independent contractor applications and statuses.</p>
      </header>

      {isLoading ? (
        <div className="text-center p-12 text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-sm">
          Loading Registry...
        </div>
      ) : providers && providers.length > 0 ? (
        <div className="grid gap-6">
          {providers.map((provider) => (
            <Card key={provider.id} className="border-none shadow-md overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Info Section */}
                <div className="flex-1 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-black text-primary uppercase tracking-tight">{provider.businessName || provider.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 font-medium">
                        <MapPin className="w-4 h-4" /> {provider.address?.city || "Unknown City"}, {provider.address?.state || "Unknown State"}
                      </div>
                    </div>
                    <div>
                      {provider.status === "approved" && <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1"><CheckCircle2 className="w-3 h-3" /> APPROVED</Badge>}
                      {provider.status === "pending_approval" && <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="w-3 h-3" /> PENDING</Badge>}
                      {provider.status === "suspended" && <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> SUSPENDED</Badge>}
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Email:</span> {provider.email}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Phone:</span> {provider.phone}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Services:</span> {provider.services?.join(", ") || "None specified"}</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {provider.insuranceDocs ? (
                      <Button variant="outline" size="sm" className="gap-2 font-bold uppercase tracking-widest text-xs" onClick={() => window.open(provider.insuranceDocs, '_blank')}>
                        <FileText className="w-4 h-4" /> View COI
                      </Button>
                    ) : (
                      <p className="text-xs text-red-500 font-bold flex items-center gap-1 uppercase tracking-widest bg-red-50 px-3 py-2 rounded-md">
                        <ShieldAlert className="w-4 h-4" /> Missing COI
                      </p>
                    )}
                    {provider.stripeAccountId && (
                      <Badge variant="outline" className="text-accent border-accent bg-accent/5">
                        Stripe Connected
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="bg-slate-50 p-6 md:w-64 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col justify-center gap-3">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 text-center">Admin Controls</p>
                  
                  {provider.status !== "approved" && (
                    <Button 
                      onClick={() => updateStatus(provider.id, "approved")}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-black uppercase tracking-widest text-xs"
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> Approve
                    </Button>
                  )}
                  
                  {provider.status !== "suspended" && (
                    <Button 
                      variant="destructive"
                      onClick={() => updateStatus(provider.id, "suspended")}
                      className="w-full font-black uppercase tracking-widest text-xs"
                    >
                      <ShieldAlert className="w-4 h-4 mr-2" /> Suspend
                    </Button>
                  )}

                  {provider.status !== "pending_approval" && (
                    <Button 
                      variant="outline"
                      onClick={() => updateStatus(provider.id, "pending_approval")}
                      className="w-full font-black uppercase tracking-widest text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                    >
                      <Clock className="w-4 h-4 mr-2" /> Set Pending
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed shadow-none bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <UserCheck className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-800">No Providers Found</h3>
            <p className="text-sm text-slate-500 mt-2">The provider database is currently empty.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProviderManagementPage() {
  return (
    <EmployeeLayout isAdmin>
      <ProviderManagementContent />
    </EmployeeLayout>
  );
}
