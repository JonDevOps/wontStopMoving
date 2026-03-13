
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Calendar, Clock, Star, TrendingUp, CheckCircle } from "lucide-react";

export default function EmployeeDashboard() {
  const stats = [
    { label: "Jobs This Month", value: "24", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Completed", value: "158", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Rating", value: "4.9", icon: Star, color: "text-accent", bg: "bg-accent/10" },
    { label: "Hours Logged", value: "142", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <EmployeeLayout>
      <div className="space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">Welcome back, <span className="text-accent">Marcus</span></h1>
          <p className="text-muted-foreground">Region: TX-North Dallas | ID: #51-8824</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-black text-primary">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                TODAY'S SCHEDULE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: "JOB-4412", customer: "Robert Wilson", time: "08:00 AM", size: "3br Home", status: "In Progress", color: "bg-blue-500" },
                  { id: "JOB-4415", customer: "Elena Rodriguez", time: "02:30 PM", size: "Studio", status: "Upcoming", color: "bg-orange-500" },
                ].map((job, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-accent transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-1.5 h-12 rounded-full ${job.color}`} />
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">{job.time} • {job.id}</p>
                        <p className="text-lg font-bold text-primary">{job.customer}</p>
                        <p className="text-xs opacity-60">{job.size}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${job.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                ANNOUNCEMENTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Team Dallas</span>
                    <span className="text-[10px] text-muted-foreground">2h ago</span>
                  </div>
                  <p className="text-sm font-bold text-primary">New Uniform Pickup</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Please stop by the regional office this Friday for your new summer kits.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Operations</span>
                    <span className="text-[10px] text-muted-foreground">1d ago</span>
                  </div>
                  <p className="text-sm font-bold text-primary">Safety Protocol Update</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Review the updated heavy-lifting procedures in the profile section.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
