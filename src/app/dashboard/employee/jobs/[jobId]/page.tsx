
"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  Phone, 
  AlertCircle, 
  Sparkles,
  ArrowLeft,
  Navigation,
  CheckCircle
} from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { aiJobNoteAssistant } from "@/ai/flows/ai-job-note-assistant";

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [status, setStatus] = useState("In Progress");
  const [rawNotes, setRawNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const jobDetails = {
    id: jobId,
    customer: "Robert Wilson",
    phone: "(555) 123-4567",
    pickup: "123 Momentum Way, Dallas, TX 75201",
    dropoff: "456 Skyline Drive, Plano, TX 75024",
    date: "May 24, 2024",
    time: "08:00 AM",
    size: "3 Bedroom Home",
    specialItems: "Upright Piano, Large Glass Table",
    notes: "Please park in the rear loading dock. Customer has 3 large dogs that will be in a kennel."
  };

  const handleAiNotes = async () => {
    if (!rawNotes) return;
    setIsGenerating(true);
    try {
      const result = await aiJobNoteAssistant({
        rawNotes,
        jobDetails: JSON.stringify(jobDetails)
      });
      setRawNotes(result.structuredNotes);
    } catch (error) {
      console.error("AI Assistant Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <EmployeeLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        <Link href="/dashboard/employee/jobs" className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to My Jobs
        </Link>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-accent text-white p-3 rounded-2xl">
              <Truck className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded uppercase">{jobDetails.id}</span>
                <h1 className="text-3xl font-black text-primary uppercase">{jobDetails.customer}</h1>
              </div>
              <p className="text-muted-foreground">{jobDetails.size} • Moving Today</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full gap-2"><Navigation className="h-4 w-4" /> Directions</Button>
            <Button variant="outline" className="rounded-full gap-2"><Phone className="h-4 w-4" /> Contact</Button>
            <Button className="rounded-full bg-green-500 hover:bg-green-600 gap-2"><CheckCircle className="h-4 w-4" /> Complete Job</Button>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="text-sm font-black tracking-widest uppercase">MOVE LOGISTICS</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  <div className="p-6 flex gap-4">
                    <div className="bg-gray-100 p-3 rounded-xl h-fit text-primary"><MapPin className="h-6 w-6" /></div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Pickup Address</p>
                        <p className="font-bold text-primary">{jobDetails.pickup}</p>
                      </div>
                      <div className="w-full h-px bg-gray-100" />
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Dropoff Address</p>
                        <p className="font-bold text-primary">{jobDetails.dropoff}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-6">
                    <div className="flex gap-3">
                      <div className="bg-gray-100 p-2 rounded-lg text-primary"><Calendar className="h-5 w-5" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</p>
                        <p className="font-bold text-primary">{jobDetails.date}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="bg-gray-100 p-2 rounded-lg text-primary"><Clock className="h-5 w-5" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Arrival</p>
                        <p className="font-bold text-primary">{jobDetails.time}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  JOB NOTES & OBSERVATIONS
                </CardTitle>
                <Button 
                  onClick={handleAiNotes} 
                  disabled={isGenerating || !rawNotes}
                  className="bg-accent hover:bg-accent/90 text-white h-8 text-xs font-bold rounded-full gap-2"
                >
                  <Sparkles className="h-3 w-3" /> {isGenerating ? "Processing..." : "Structure with AI"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  placeholder="Type unstructured job notes here (e.g. 'all boxes loaded, piano wrapped, customer happy with the team')..."
                  className="min-h-[200px] border-gray-200 focus:ring-accent"
                />
                <div className="flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90 rounded-full px-8">Save Notes</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="border-none shadow-sm bg-accent text-white">
              <CardHeader>
                <CardTitle className="text-xs font-black tracking-widest uppercase">QUICK STATUS UPDATE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["En Route", "Arrived", "Loading", "In Transit", "Delivered"].map((st) => (
                  <button 
                    key={st} 
                    onClick={() => setStatus(st)}
                    className={`w-full py-3 px-4 rounded-xl text-left text-sm font-bold border transition-all ${status === st ? 'bg-white text-accent border-white' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                  >
                    {st}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-xs font-black tracking-widest uppercase text-primary">SPECIAL REQUIREMENTS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="bg-orange-100 text-accent p-2 rounded-lg h-fit"><AlertCircle className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Special Items</p>
                    <p className="text-sm font-bold text-primary leading-relaxed">{jobDetails.specialItems}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg h-fit"><User className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Admin Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{jobDetails.notes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
