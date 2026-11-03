"use client";

import { useState } from "react";
import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, PlayCircle, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProviderTrainingPage() {
  const { toast } = useToast();
  const [completedIds, setCompletedIds] = useState<string[]>(["intro"]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const courses = [
    {
      id: "intro",
      title: "Welcome to Wont Stop Moving",
      description: "Learn how our platform works, how to accept jobs, and how escrows guarantee your payment.",
      duration: "5 min",
      type: "video",
      icon: PlayCircle,
      keyPoints: [
        "Customers book you directly at your hourly rate and minimum hours.",
        "Customer funds are held in Stripe Escrow before you arrive.",
        "When the move finishes, collect the customer's 6-digit Release Code to unlock your 85% payout."
      ]
    },
    {
      id: "safety",
      title: "Essential Safety & Lifting Protocols",
      description: "Mandatory training on lifting form, dealing with heavy items, and avoiding workplace injuries.",
      duration: "15 min",
      type: "video",
      icon: PlayCircle,
      keyPoints: [
        "Always lift with your legs, keep the load close to your core, and never twist while carrying weight.",
        "Use forearm straps or appliance dollies for items over 100 lbs.",
        "Walk the path from the truck to the residence before lifting to clear tripping hazards."
      ]
    },
    {
      id: "packing",
      title: "Professional Packing Best Practices",
      description: "Step-by-step guide on securely wrapping fragile items, building boxes, and organizing trucks.",
      duration: "10 min",
      type: "article",
      icon: FileText,
      keyPoints: [
        "Pad and shrink-wrap all wood, glass, and upholstered furniture before leaving the room.",
        "Build stable 'tiers' in the truck: heavy appliances and dressers on the floor, lighter boxes on top.",
        "Ratchet-strap every tier to the E-track rails before driving."
      ]
    },
    {
      id: "customer",
      title: "5-Star Customer Service",
      description: "Tips on communication, handling disputes on-site, and securing 5-star reviews to get more jobs.",
      duration: "8 min",
      type: "video",
      icon: PlayCircle,
      keyPoints: [
        "Call or message the customer 30 minutes prior to arrival with your exact ETA.",
        "Do a walkthrough together at pickup and before final sign-off at drop-off.",
        "Ask for the 6-digit Payment Release Code and invite the customer to leave a 5-star review!"
      ]
    }
  ];

  const handleToggleComplete = (id: string, title: string) => {
    if (!completedIds.includes(id)) {
      setCompletedIds((prev) => [...prev, id]);
      toast({
        title: "Module Completed! 🎓",
        description: `You completed "${title}".`,
      });
    }
    setActiveCourseId(null);
  };

  return (
    <ProviderLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Provider Training Academy</h1>
              <p className="text-muted-foreground text-sm flex items-center mt-0.5">
                Complete your modules to boost your platform ranking and get assigned to premium jobs.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
            {completedIds.length} / {courses.length} Completed
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {courses.map((course) => {
            const isCompleted = completedIds.includes(course.id);
            const isExpanded = activeCourseId === course.id;
            return (
              <Card key={course.id} className="shadow-sm border-gray-100 hover:border-blue-100 transition-colors group hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <course.icon className="h-5 w-5 text-accent group-hover:text-blue-600 transition-colors" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{course.duration}</span>
                    </div>
                    {isCompleted ? (
                      <div className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        COMPLETED
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                        START MODULE
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3 group-hover:text-blue-700 transition-colors">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm">
                    {course.description}
                  </CardDescription>

                  {isExpanded && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                      <p className="font-black uppercase tracking-widest text-slate-900">Key Takeaways:</p>
                      <ul className="space-y-1.5 list-disc pl-4">
                        {course.keyPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                      <div className="pt-2 flex justify-end">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white font-bold"
                          onClick={() => handleToggleComplete(course.id, course.title)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          {isCompleted ? "Done Reviewing" : "Mark Module Complete"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant={isCompleted ? "outline" : "default"}
                      size="sm"
                      className={isCompleted ? "" : "bg-slate-900 text-white"}
                      onClick={() => setActiveCourseId(isExpanded ? null : course.id)}
                    >
                      {isExpanded ? "Hide Lesson" : isCompleted ? "Review Module" : "Start Learning"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ProviderLayout>
  );
}
