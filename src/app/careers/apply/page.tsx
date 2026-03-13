
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
import { useFirestore, useAuth } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const appSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password required for your account"),
  phone: z.string().min(10, "Invalid phone"),
  state: z.string().min(1, "Select state"),
  experience: z.string().min(1, "Years of experience required"),
  hasLicense: z.boolean().default(false),
  hasCDL: z.boolean().default(false),
  coverLetter: z.string().optional(),
});

type AppValues = z.infer<typeof appSchema>;

export default function ApplicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AppValues>({
    resolver: zodResolver(appSchema),
  });

  const onSubmit = async (data: AppValues) => {
    setIsLoading(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // 2. Create User Profile
      const userRef = doc(firestore, "users", user.uid);
      setDoc(userRef, {
        id: user.uid,
        email: data.email,
        name: data.fullName,
        role: 'employee',
        state: data.state,
        createdAt: serverTimestamp(),
      });

      // 3. Create Employee Profile (Training/Applicant Status)
      const employeeRef = doc(firestore, "employees", user.uid);
      setDoc(employeeRef, {
        id: user.uid,
        userId: user.uid,
        employeeId: `EMP-${Math.floor(Math.random() * 90000) + 10000}`,
        state: data.state,
        region: "Pending Assignment",
        hireDate: serverTimestamp(),
        status: 'applicant', // Training mode
        availability: "{}",
      });

      // 4. Create Application Document
      const applicationRef = doc(collection(firestore, "applications"));
      setDoc(applicationRef, {
        id: applicationRef.id,
        userId: user.uid,
        name: data.fullName,
        email: data.email,
        phone: data.phone,
        state: data.state,
        experience: data.experience,
        resume: "https://example.com/resume-placeholder.pdf",
        status: 'new',
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
      // Automatically redirect to the applicant version of the dashboard
      setTimeout(() => {
        router.push('/dashboard/employee');
      }, 3000);

    } catch (error: any) {
      console.error("Application/Auth Error:", error);
      toast({
        variant: "destructive",
        title: "Application Error",
        description: error.message || "Failed to process application.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl p-12 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-black text-primary mb-4 uppercase tracking-tighter">Application Received</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Account created successfully! We are redirecting you to your employee dashboard where you can begin your training while we review your application.
          </p>
          <div className="animate-pulse text-accent font-bold uppercase tracking-widest text-xs">
            Redirecting to Portal...
          </div>
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
            <p className="text-muted-foreground">Apply now to create your account and start your journey.</p>
          </div>

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} placeholder="Jane Doe" required />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" required />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="password">Create Account Password</Label>
                    <Input id="password" type="password" {...register("password")} placeholder="******" required />
                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" required />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                  </div>
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
                    </SelectContent>
                  </Select>
                  {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Years of Experience in Moving/Logistics</Label>
                  <Input id="experience" type="number" {...register("experience")} placeholder="0" min="0" required />
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

                <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 h-14 text-lg font-bold rounded-xl uppercase tracking-wider">
                  {isLoading ? "Processing Application..." : "Submit Application & Create Account"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
