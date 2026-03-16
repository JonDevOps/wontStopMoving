
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ALL_LOCATIONS } from "@/lib/location-data";
import { User, Mail, Phone, MapPin, Save, ShieldCheck, ShieldAlert } from "lucide-react";

function AdminProfileContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc(userRef);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setState(profile.state || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!userRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userRef, {
        name,
        phone,
        state,
      });
      toast({
        title: "Admin Profile Updated",
        description: "Your system identity has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update profile settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 text-center animate-pulse font-bold text-primary uppercase tracking-widest text-xs">
        Loading Admin Credentials...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-black text-primary uppercase">System <span className="text-accent">Administrator</span></h1>
        <p className="text-muted-foreground">Manage your administrative identity and security settings</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <User className="h-4 w-4 text-accent" />
                Administrative Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Administrator Name"
                    className="h-12 border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">System Email</Label>
                  <Input 
                    id="email" 
                    value={profile?.email || ""} 
                    disabled 
                    className="h-12 bg-gray-50 border-gray-200 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Master email is managed by the root system.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="h-12 border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Assigned Hub Region</Label>
                  <Select onValueChange={setState} value={state}>
                    <SelectTrigger className="h-12 border-gray-200">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 rounded-full px-10 h-12 font-bold uppercase tracking-widest text-xs gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Synchronizing..." : "Save Admin Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-l-4 border-accent bg-accent/5">
            <CardContent className="p-6 flex items-start gap-4">
              <ShieldAlert className="h-6 w-6 text-accent shrink-0 mt-1" />
              <div className="space-y-1">
                <h4 className="font-bold text-primary uppercase text-sm">Privileged Access</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your account has global read/write permissions for all 51 regions. Ensure your contact information is accurate for system logs and audit trails.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
            <CardContent className="p-8 space-y-4">
              <div className="bg-white/20 p-3 rounded-2xl w-fit">
                <ShieldCheck className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-black uppercase tracking-tight text-xl leading-none">Security Center</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                As a System Administrator, you are required to use strong authentication. Password resets require verification from the root security hub.
              </p>
              <Button variant="ghost" className="w-full text-white hover:bg-white/10 border border-white/20 rounded-xl font-bold uppercase tracking-widest text-[10px] h-10">
                Reset Master Password
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Account Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Role Level</span>
                <span className="font-black text-accent uppercase">Super Admin</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Access Scope</span>
                <span className="font-bold">51 Regions</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Last Login</span>
                <span className="font-bold">Today</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminProfilePage() {
  return (
    <EmployeeLayout isAdmin>
      <AdminProfileContent />
    </EmployeeLayout>
  );
}
