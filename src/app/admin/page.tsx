import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, FileText, ClipboardList, TrendingUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AdminDashboard() {
  const kpis = [
    { label: "Total Revenue", value: "$42,850", trend: "+12.5%", icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Active Jobs", value: "32", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Unassigned", value: "8", icon: AlertCircle, color: "text-accent", bg: "bg-accent/10" },
    { label: "Employees", value: "51,000", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <EmployeeLayout isAdmin>
      <div className="space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-primary uppercase">System <span className="text-accent">Overview</span></h1>
          <p className="text-muted-foreground">Nationwide Logistics Control Center</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}>
                    <kpi.icon className="h-6 w-6" />
                  </div>
                  {kpi.trend && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{kpi.trend}</span>
                  )}
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                <p className="text-3xl font-black text-primary mt-1">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>RECENT APPLICATIONS</CardTitle>
              <button className="text-xs font-bold text-accent hover:underline">View All</button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Sarah Jenkins", state: "TX", exp: "5 years", status: "Reviewing" },
                  { name: "David Miller", state: "NY", exp: "2 years", status: "New" },
                  { name: "Linda Chen", state: "CA", exp: "8 years", status: "Reviewing" },
                ].map((app, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">{app.name[0]}</div>
                      <div>
                        <p className="font-bold text-primary">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.state} • {app.exp} Exp</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${app.status === 'New' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>REGIONAL QUOTAS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { state: "Texas", capacity: 85 },
                { state: "New York", capacity: 42 },
                { state: "California", capacity: 68 },
                { state: "Puerto Rico", capacity: 25 },
              ].map((region, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase">
                    <span>{region.state}</span>
                    <span className="text-accent">{region.capacity}%</span>
                  </div>
                  <Progress value={region.capacity} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployeeLayout>
  );
}
