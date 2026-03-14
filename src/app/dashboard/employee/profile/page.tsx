
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
import { User, Mail, Phone, MapPin, Save, ShieldCheck, Briefcase, Calendar, IdCard, Star, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeProfilePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const employeeRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "employees", user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: userLoading } = useDoc(userRef);
  const { data: employeeProfile, isLoading: employeeLoading } = useDoc(employeeRef);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || "");
      setPhone(userProfile.phone || "");
      setState(userProfile.state || "");
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!userRef || !employeeRef) return;
    setIsSaving(true);
    try {
      // Update User Profile
      await updateDoc(userRef, {
        name,
        phone,
        state,
      });

      // Update Employee Profile (state sync)
      await updateDoc(employeeRef, {
        state,
      });

      toast({
        title: "Profile Updated",
        description: "Your professional information has been saved successfully.",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update profile. Please try again later.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading || employeeLoading) {
    return (
      <EmployeeLayout>
        <div className="p-20 text-center animate-pulse font-bold text-primary uppercase tracking-widest text-xs">
          Accessing Personnel Records...
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">My <span className="text-accent">Profile</span></h1>
          <p className="text-muted-foreground">Manage your professional identity and contact information</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
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
                      className="h-12 border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email</Label>
                    <Input 
                      id="email" 
                      value={userProfile?.email || ""} 
                      disabled 
                      className="h-12 bg-gray-50 border-gray-200 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Primary email cannot be changed.</p>
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
                    <Label htmlFor="state">Region / Home State</Label>
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
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-accent" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employee ID</p>
                  <p className="font-bold text-primary flex items-center gap-2">
                    <IdCard className="h-3.5 w-3.5 text-accent" />
                    #{employeeProfile?.employeeId || "PENDING"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${employeeProfile?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {employeeProfile?.status || "Applicant"}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hire Date</p>
                  <p className="font-bold text-primary flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-accent" />
                    {employeeProfile?.hireDate?.toDate ? format(employeeProfile.hireDate.toDate(), "MMM d, yyyy") : "TBD"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duty Region</p>
                  <p className="font-bold text-primary flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    {employeeProfile?.region || "National"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
              <CardContent className="p-8 space-y-4">
                <div className="bg-white/20 p-3 rounded-2xl w-fit">
                  <Star className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-xl leading-none">Service Excellence</h3>
                <p className="text-sm opacity-80 leading-relaxed">
                  You are part of a nationwide network of 51,000 professionals. Maintain your profile accuracy to ensure correct regional dispatching.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 p-3 rounded-xl border border-white/10">
                  <CheckCircle className="h-4 w-4 text-accent" />
                  Personnel Verified
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Account Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Need to change your access credentials? A secure reset link will be sent to your verified work email address.
                </p>
                <Button variant="outline" className="w-full rounded-xl font-bold text-[10px] uppercase tracking-widest border-gray-200 h-10">
                  Reset System Password
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
