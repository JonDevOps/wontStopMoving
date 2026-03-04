import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, ChevronRight, Truck } from "lucide-react";
import Link from "next/link";

export default function EmployeeJobs() {
  const jobs = [
    { id: "JOB-4412", customer: "Robert Wilson", date: "Today", time: "08:00 AM", pickup: "Dallas, TX", dropoff: "Plano, TX", size: "3br Home", status: "In Progress" },
    { id: "JOB-4415", customer: "Elena Rodriguez", date: "Today", time: "02:30 PM", pickup: "Irving, TX", dropoff: "Frisco, TX", size: "Studio", status: "Upcoming" },
    { id: "JOB-4420", customer: "Michael Thompson", date: "Tomorrow", time: "09:00 AM", pickup: "Fort Worth, TX", dropoff: "Dallas, TX", size: "2br Apt", status: "Upcoming" },
    { id: "JOB-4390", customer: "Sarah Miller", date: "Yesterday", time: "11:00 AM", pickup: "Arlington, TX", dropoff: "Dallas, TX", size: "Office", status: "Completed" },
  ];

  return (
    <EmployeeLayout>
      <div className="space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase">My Assigned <span className="text-accent">Jobs</span></h1>
            <p className="text-muted-foreground">Manage your current and upcoming assignments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full bg-white border-gray-200">Active</Button>
            <Button variant="ghost" className="rounded-full">History</Button>
          </div>
        </header>

        <div className="grid gap-4">
          {jobs.map((job) => (
            <Link key={job.id} href={`/employee/jobs/${job.id}`}>
              <Card className="border-none shadow-sm hover:shadow-md hover:border-accent border border-transparent transition-all group overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    <div className={`w-full md:w-32 flex flex-col items-center justify-center p-6 text-white ${job.status === 'Completed' ? 'bg-green-500' : job.status === 'In Progress' ? 'bg-blue-500' : 'bg-primary'}`}>
                      <p className="text-[10px] font-black uppercase opacity-60 mb-1">{job.date}</p>
                      <p className="text-lg font-black">{job.time.split(' ')[0]}</p>
                      <p className="text-[10px] font-black uppercase">{job.time.split(' ')[1]}</p>
                    </div>
                    
                    <div className="flex-1 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-accent text-white px-2 py-0.5 rounded uppercase">{job.id}</span>
                          <h3 className="text-xl font-bold text-primary">{job.customer}</h3>
                        </div>
                        
                        <div className="flex flex-wrap gap-8 text-sm">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Route</p>
                            <p className="font-bold flex items-center gap-2">
                              {job.pickup} <ChevronRight className="h-3 w-3 text-accent" /> {job.dropoff}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Move Size</p>
                            <p className="font-bold">{job.size}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          job.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                          job.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {job.status}
                        </span>
                        <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </EmployeeLayout>
  );
}
