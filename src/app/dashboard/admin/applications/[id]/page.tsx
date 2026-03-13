
"use client";

import { useDoc, useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EmployeeLayout } from "@/components/layout/employee-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Mail, Phone, MapPin, Briefcase, FileText, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { aiApplicationSummarizer, type ApplicationSummarizerOutput } from "@/ai/flows/ai-application-summarizer";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { data: application, isLoading } = useDoc(doc(firestore, "applications", id));
  
  const [aiSummary, setAiSummary] = useState<ApplicationSummarizerOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpdateStatus = async (newStatus: 'active' | 'rejected' | 'new') => {
    if (!application || !application.userId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Candidate account link not found.",
      });
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Update the Application record
      await updateDoc(doc(firestore, "applications", id), {
        status: newStatus === 'active' ? 'approved' : newStatus
      });

      // 2. Update the Employee Profile status (The "Switch")
      await updateDoc(doc(firestore, "employees", application.userId), {
        status: newStatus
      });

      toast({
        title: "Status Updated",
        description: `Candidate status has been set to ${newStatus}. Their dashboard has been updated.`,
      });
    } catch (error: any) {
      console.error("Status Update Error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "You may not have permission to perform this action.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSummarize = async () => {
    if (!application) return;
    setIsSummarizing(true);
    try {
      const result = await aiApplicationSummarizer({
        applicationText: JSON.stringify(application),
        resumeDataUri: "data:application/pdf;base64,JVBERi0xLjQKJ..." // Placeholder
      });
      setAiSummary(result);
    } catch (error) {
      console.error("AI Summarizer Error:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading) return <EmployeeLayout isAdmin><div className="p-20 text-center font-bold text-primary animate-pulse uppercase tracking-widest">Loading Application...</div></EmployeeLayout>;
  if (!application) return <EmployeeLayout isAdmin><div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Application not found.</div></EmployeeLayout>;

  return (
    <EmployeeLayout isAdmin>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Overview
        </Link>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center text-2xl font-black">
              {application.name?.[0]}
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase">{application.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  className={
                    application.status === 'approved' ? "bg-green-500 hover:bg-green-500" : 
                    application.status === 'rejected' ? "bg-red-500 hover:bg-red-500" : 
                    "bg-orange-500 hover:bg-orange-500"
                  }
                >
                  {application.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{application.state} • {application.experience} Years Experience</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleSummarize} 
              disabled={isSummarizing}
              className="bg-accent hover:bg-accent/90 text-white rounded-full px-6 font-bold flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isSummarizing ? "Analyzing..." : "AI Review"}
            </Button>
            <Button variant="outline" className="rounded-full px-6 font-bold border-primary text-primary">Contact Candidate</Button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {aiSummary && (
              <Card className="border-accent/20 bg-accent/5 shadow-sm overflow-hidden animate-fade-in">
                <CardHeader className="bg-accent text-white flex flex-row items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <CardTitle className="text-sm font-black tracking-widest uppercase">AI Intelligence Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h4 className="text-xs font-black text-accent uppercase mb-2">Candidate Fit</h4>
                    <p className="text-primary font-medium leading-relaxed">{aiSummary.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-black text-accent uppercase mb-2">Key Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {aiSummary.keySkills.map((skill, i) => (
                          <Badge key={i} className="bg-white border-accent/20 text-accent font-bold">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-accent uppercase mb-2">Qualification Match</h4>
                      <p className="text-sm text-primary">{aiSummary.qualificationMatch}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Candidate Data</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-primary"><Mail className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Email</p>
                    <p className="font-bold text-sm">{application.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-primary"><Phone className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone</p>
                    <p className="font-bold text-sm">{application.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-primary"><MapPin className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Location</p>
                    <p className="font-bold text-sm">{application.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-primary"><Briefcase className="h-4 w-4" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Experience</p>
                    <p className="font-bold text-sm">{application.experience} Years</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-black tracking-widest uppercase text-muted-foreground">Experience Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-primary leading-relaxed whitespace-pre-wrap bg-gray-50 p-6 rounded-2xl border border-gray-100 italic">
                  "{application.experience} years of experience in the industry. Seeking new opportunities in the {application.state} region."
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="border-none shadow-sm bg-primary text-white">
              <CardHeader>
                <CardTitle className="text-xs font-black tracking-widest uppercase">ATTACHMENTS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm font-bold">Resume.pdf</p>
                      <p className="text-[10px] opacity-60 uppercase">PDF Document</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">View</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-t-4 border-accent">
              <CardHeader>
                <CardTitle className="text-xs font-black tracking-widest uppercase text-primary">ADMIN ACTIONS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => handleUpdateStatus('active')}
                  disabled={isProcessing || application.status === 'approved'}
                  className="w-full bg-green-500 hover:bg-green-600 rounded-xl font-bold h-12 uppercase text-xs flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {isProcessing ? "Processing..." : "Approve & Activate"}
                </Button>
                
                <Button 
                  onClick={() => handleUpdateStatus('rejected')}
                  disabled={isProcessing || application.status === 'rejected'}
                  variant="ghost" 
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold h-12 uppercase text-xs flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Application
                </Button>

                {application.status !== 'new' && (
                  <Button 
                    onClick={() => handleUpdateStatus('new')}
                    disabled={isProcessing}
                    variant="link" 
                    className="w-full text-muted-foreground text-[10px] uppercase font-bold"
                  >
                    Reset to Pending
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
