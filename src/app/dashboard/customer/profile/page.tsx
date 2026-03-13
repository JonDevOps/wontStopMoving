
"use client";

import { CustomerLayout } from "@/components/layout/customer-layout";
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
import { User, Mail, Phone, MapPin, Save, ShieldCheck } from "lucide-react";

export default function CustomerProfilePage() {
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
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="p-20 text-center animate-pulse font-bold text-primary uppercase tracking-widest text-xs">
          Loading Profile...
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">My <span className="text-accent">Profile</span></h1>
          <p className="text-muted-foreground">Manage your personal information and account settings</p>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <User className="h-4 w-4 text-accent" />
                  Personal Information
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
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={profile?.email || ""} 
                      disabled 
                      className="bg-gray-50"
                    />
                    <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Region / State</Label>
                    <Select onValueChange={setState} value={state}>
                      <SelectTrigger>
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
                    className="bg-primary hover:bg-primary/90 rounded-full px-8 gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-accent text-white overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="bg-white/20 p-3 rounded-2xl w-fit">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-xl">Account Security</h3>
                <p className="text-sm opacity-80 leading-relaxed">
                  Your account is protected by industry-standard encryption and Firebase Authentication.
                </p>
                <Button variant="ghost" className="w-full text-white hover:bg-white/10 border border-white/20 rounded-xl font-bold">
                  Reset Password
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-bold">{profile?.createdAt?.toDate ? new Date(profile.createdAt.toDate()).getFullYear() : "2024"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Account Type</span>
                  <span className="font-black text-accent uppercase text-[10px]">{profile?.role || "Customer"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
