
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
import { useState, use, useEffect } from "react";
import { aiJobNoteAssistant } from "@/ai/flows/ai-job-note-assistant";
import { useAuth, useFirestore } from "@/firebase";
import { idTokenOf } from "@/lib/api-client";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { MoveDetailsEditor } from "@/components/jobs/move-details-editor";
import { JobTeamPanel } from "@/components/jobs/job-team-panel";
import { formatMoveDate } from "@/lib/move-details";

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState("In Progress");
  const [rawNotes, setRawNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveJob, setLiveJob] = useState<any>(null);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const loadJob = async () => {
      if (!firestore || !jobId) return;
      try {
        const snap = await getDoc(doc(firestore, "jobs", jobId));
        if (snap.exists()) {
          const data = snap.data();
          setLiveJob({ id: snap.id, ...data });
          if (data.employeeNotes) setRawNotes(data.employeeNotes);
          if (data.crewStatus) setStatus(data.crewStatus);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadJob();
  }, [firestore, jobId, reloadKey]);

  const jobDetails = {
    id: liveJob?.id || jobId,
    customer: liveJob?.customerName || liveJob?.customerEmail || "Customer",
    phone: liveJob?.phone || "Not provided",
    pickup: liveJob?.pickupAddress || "Not provided",
    dropoff: liveJob?.dropoffAddress || "Not provided",
    date: formatMoveDate(liveJob?.moveDate),
    time: liveJob?.moveTime || "To be confirmed",
    size: liveJob?.moveSize ? `${liveJob.moveSize.toUpperCase()} Move` : "Size not specified",
    specialItems: liveJob?.specialItems || "None listed",
    notes: liveJob?.notes || "No notes yet."
  };

  const handleSaveNotes = async () => {
    if (liveJob && firestore) {
      try {
        await updateDoc(doc(firestore, "jobs", jobId), {
          employeeNotes: rawNotes,
          crewStatus: status,
        });
      } catch {}
    }
    toast({
      title: "Field Notes Saved",
      description: "Your job notes and crew status have been recorded.",
    });
  };

  const handleCompleteJob = async () => {
    setStatus("Delivered");
    if (liveJob && firestore) {
      try {
        // Crew records delivery; the job is completed (and paid out) when the
        // customer's release code is entered.
        await updateDoc(doc(firestore, "jobs", jobId), {
          crewStatus: "Delivered",
        });
      } catch {}
    }
    toast({
      title: "Delivery Recorded! 🎉",
      description: "Dispatch has been updated with final delivery confirmation.",
    });
  };

  const handleAiNotes = async () => {
    if (!rawNotes) return;
    setIsGenerating(true);
    try {
      const result = await aiJobNoteAssistant({
        rawNotes,
        jobDetails: JSON.stringify(jobDetails)
      }, await idTokenOf(auth));
      setRawNotes(result.structuredNotes);
    } catch (error) {
      console.error("AI Assistant Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!liveJob) {
    return (
      <EmployeeLayout>
        <div className="max-w-3xl mx-auto py-24 text-center space-y-4">
          <h1 className="text-2xl font-black text-primary uppercase">Job not found</h1>
          <p className="text-muted-foreground">This job doesn't exist or isn't assigned to you.</p>
          <Link href="/dashboard/employee/jobs" className="text-accent font-bold hover:underline">Back to My Jobs</Link>
        </div>
      </EmployeeLayout>
    );
  }

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
              <p className="text-muted-foreground">{jobDetails.size} • {jobDetails.date}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(jobDetails.pickup)}&destination=${encodeURIComponent(jobDetails.dropoff)}`, "_blank")}
            >
              <Navigation className="h-4 w-4" /> Directions
            </Button>
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => window.location.href = `tel:${jobDetails.phone}`}
            >
              <Phone className="h-4 w-4" /> Contact
            </Button>
            <Button
              onClick={handleCompleteJob}
              className="rounded-full bg-green-500 hover:bg-green-600 gap-2"
            >
              <CheckCircle className="h-4 w-4" /> Complete Job
            </Button>
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

            {liveJob && <MoveDetailsEditor jobId={jobId} job={liveJob} onSaved={() => setReloadKey(k => k + 1)} />}
            <JobTeamPanel jobId={jobId} />

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
                  <Button onClick={handleSaveNotes} className="bg-primary hover:bg-primary/90 rounded-full px-8">Save Notes</Button>
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
