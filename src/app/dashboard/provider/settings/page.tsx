"use client";

import { useState } from "react";
import { useUser } from "@/firebase";
import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Lock, User, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProviderSettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Simulate saving preferences
    setTimeout(() => {
      setSaving(false);
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully."
      });
    }, 800);
  };

  return (
    <ProviderLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and security settings.</p>
        </div>
        
        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile Reference */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-accent" />
                <CardTitle>Account Identifier</CardTitle>
              </div>
              <CardDescription>
                Your authenticated login credentials. To edit your public profile (Bio, Name, Services), visit your main Dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Login Email Address</Label>
                  <Input 
                    type="email" 
                    value={user?.email || ""} 
                    disabled 
                    className="bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">Contact dispatch support to change your email.</p>
                </div>
                <div className="space-y-2">
                  <Label>System Account ID</Label>
                  <Input 
                    type="text" 
                    value={user?.uid || ""} 
                    disabled 
                    className="bg-gray-50 text-gray-500 cursor-not-allowed font-mono text-sm border-gray-200" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-blue-500" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>
                Manage how you receive updates about new job assignments and platform messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-gray-50">
                <div className="space-y-0.5">
                  <Label className="text-base cursor-pointer" htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive daily summaries and critical job updates.</p>
                </div>
                <Switch 
                  id="email-notif"
                  checked={emailNotifications} 
                  onCheckedChange={setEmailNotifications} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base cursor-pointer" htmlFor="sms-notif">SMS Text Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get instant texts when you are hired for a new job.</p>
                </div>
                <Switch 
                  id="sms-notif"
                  checked={smsNotifications} 
                  onCheckedChange={setSmsNotifications} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-emerald-500" />
                <CardTitle>Login Security</CardTitle>
              </div>
              <CardDescription>
                Manage your password and authentication security preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                type="button" 
                variant="outline" 
                className="bg-white border-gray-200"
                onClick={() => toast({ title: "Reset link sent!", description: "Check your email for instructions to reset your password." })}
              >
                Send Password Reset Email
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" className="bg-slate-900 text-white min-w-[150px] shadow-sm hover:bg-slate-800" disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="pt-10">
          <Card className="border-red-100 bg-red-50/30">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <CardTitle className="text-red-700">Danger Zone</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600/80 mb-4 font-medium">
                Permanently delete your provider account and remove access to the platform. This action restricts access to your escrow payouts and cannot be undone.
              </p>
              <Button variant="destructive" className="bg-red-500 hover:bg-red-600 shadow-sm" onClick={() => toast({ variant: "destructive", title: "Action Disabled", description: "Please contact an Administrator to permanently delete an escrow-enabled account."})}>
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProviderLayout>
  );
}
