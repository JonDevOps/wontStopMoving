"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

const appSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Invalid phone"),
  state: z.string().min(1, "Select state"),
  experience: z.string().min(1, "Years of experience required"),
  hasLicense: z.boolean().default(false),
  hasCDL: z.boolean().default(false),
  coverLetter: z.string().optional(),
});

type AppValues = z.infer<typeof appSchema>;

export default function ApplicationPage() {
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AppValues>({
    resolver: zodResolver(appSchema),
  });

  const onSubmit = (data: AppValues) => {
    console.log("Application Submitted:", data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl p-12 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-black text-primary mb-4 uppercase tracking-tighter">Application Received</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">Thank you for your interest! Our recruitment team will review your application and contact you soon.</p>
          <Button asChild className="bg-primary rounded-full px-8 w-full">
            <Link href="/">Return Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/careers" className="inline-flex items-center gap-2 text-primary font-bold mb-8 hover:text-accent transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Careers
          </Link>
          
          <div className="mb-12">
            <h1 className="text-4xl font-black text-primary mb-2 uppercase">JOIN THE <span className="text-accent">MOVEMENT</span></h1>
            <p className="text-muted-foreground">Complete the form below to start your career with Wont Stop Moving.</p>
          </div>

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} placeholder="Jane Doe" />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Region of Interest</Label>
                    <Select onValueChange={(val) => setValue("state", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TX">Texas</SelectItem>
                        <SelectItem value="NY">New York</SelectItem>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="FL">Florida</SelectItem>
                        <SelectItem value="PR">Puerto Rico</SelectItem>
                        <SelectItem value="OTHER">Other State</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Years of Experience in Moving/Logistics</Label>
                  <Input id="experience" type="number" {...register("experience")} placeholder="0" min="0" />
                  {errors.experience && <p className="text-xs text-destructive">{errors.experience.message}</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-8 py-4 px-6 bg-gray-50 rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <Checkbox id="hasLicense" onCheckedChange={(val) => setValue("hasLicense", val === true)} />
                    <Label htmlFor="hasLicense" className="font-bold text-primary">Valid Driver's License</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="hasCDL" onCheckedChange={(val) => setValue("hasCDL", val === true)} />
                    <Label htmlFor="hasCDL" className="font-bold text-primary">Commercial Driver's License (CDL)</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Resume Upload</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-accent transition-colors cursor-pointer bg-gray-50/50">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm font-bold text-primary mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PDF, DOC up to 10MB</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
                  <Textarea id="coverLetter" {...register("coverLetter")} placeholder="Tell us why you'd be a great fit for our team..." className="min-h-[150px]" />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-14 text-lg font-bold rounded-xl uppercase tracking-wider">
                  Submit Application
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
