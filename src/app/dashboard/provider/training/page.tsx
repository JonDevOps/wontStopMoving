"use client";

import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, PlayCircle, FileText, CheckCircle2 } from "lucide-react";

export default function ProviderTrainingPage() {
  const courses = [
    {
      id: "intro",
      title: "Welcome to Wont Stop Moving",
      description: "Learn how our platform works, how to accept jobs, and how escrows guarantee your payment.",
      duration: "5 min",
      type: "video",
      icon: PlayCircle,
      completed: true
    },
    {
      id: "safety",
      title: "Essential Safety & Lifting Protocols",
      description: "Mandatory training on lifting form, dealing with heavy items, and avoiding workplace injuries.",
      duration: "15 min",
      type: "video",
      icon: PlayCircle,
      completed: false
    },
    {
      id: "packing",
      title: "Professional Packing Best Practices",
      description: "Step-by-step guide on securely wrapping fragile items, building boxes, and organizing trucks.",
      duration: "10 min",
      type: "article",
      icon: FileText,
      completed: false
    },
    {
      id: "customer",
      title: "5-Star Customer Service",
      description: "Tips on communication, handling disputes on-site, and securing 5-star reviews to get more jobs.",
      duration: "8 min",
      type: "video",
      icon: PlayCircle,
      completed: false
    }
  ];

  return (
    <ProviderLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {courses.map((course) => (
            <Card key={course.id} className="shadow-sm border-gray-100 hover:border-blue-100 transition-colors cursor-pointer group hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <course.icon className="h-5 w-5 text-accent group-hover:text-blue-600 transition-colors" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{course.duration}</span>
                  </div>
                  {course.completed ? (
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
              <CardContent>
                <CardDescription className="text-sm">
                  {course.description}
                </CardDescription>
                <div className="mt-4 flex justify-end">
                  <Button variant={course.completed ? "outline" : "default"} size="sm" className={course.completed ? "" : "bg-slate-900 text-white"}>
                    {course.completed ? "Review Module" : "Start Learning"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ProviderLayout>
  );
}
