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
import { Truck, MapPin, Package, User, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";

const formSchema = z.object({
  pickupZip: z.string().min(5, "Invalid Zip"),
  dropoffZip: z.string().min(5, "Invalid Zip"),
  moveDate: z.string().min(1, "Select a date"),
  moveSize: z.string().min(1, "Select move size"),
  specialItems: z.string().optional(),
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Invalid phone"),
});

type FormValues = z.infer<typeof formSchema>;

export function QuoteForm() {
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const firestore = useFirestore();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      moveSize: "1br",
    }
  });

  const onSubmit = (data: FormValues) => {
    const quotesRef = collection(firestore, 'quotes');
    addDocumentNonBlocking(quotesRef, {
      ...data,
      status: 'new',
      createdAt: serverTimestamp(),
      details: JSON.stringify({
        pickupZip: data.pickupZip,
        dropoffZip: data.dropoffZip,
        moveDate: data.moveDate,
        moveSize: data.moveSize,
        specialItems: data.specialItems
      })
    });
    setStep(5); // Success step
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const progress = (step / totalSteps) * 100;

  if (step === 5) {
    return (
      <Card className="border-none shadow-2xl bg-white p-12 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black text-primary mb-4 uppercase tracking-tighter">Quote Requested!</h2>
        <p className="text-muted-foreground mb-8">Thank you, {watch("name")}! We've sent a confirmation to {watch("email")}. A moving specialist will contact you shortly.</p>
        <Button asChild className="bg-primary rounded-full px-8">
          <a href="/">Back to Home</a>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-2xl bg-white overflow-hidden">
      <div className="h-2 bg-gray-100">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <CardContent className="p-8 md:p-12">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Logistics */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><MapPin className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Where are you moving?</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="pickupZip">Pickup Zip Code</Label>
                  <Input id="pickupZip" {...register("pickupZip")} placeholder="e.g. 75201" />
                  {errors.pickupZip && <p className="text-xs text-destructive">{errors.pickupZip.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoffZip">Dropoff Zip Code</Label>
                  <Input id="dropoffZip" {...register("dropoffZip")} placeholder="e.g. 10001" />
                  {errors.dropoffZip && <p className="text-xs text-destructive">{errors.dropoffZip.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moveDate">Move Date</Label>
                <Input id="moveDate" type="date" {...register("moveDate")} />
                {errors.moveDate && <p className="text-xs text-destructive">{errors.moveDate.message}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Size */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">What are we moving?</h3>
              </div>
              <div className="space-y-2">
                <Label>Home Size</Label>
                <Select onValueChange={(val) => setValue("moveSize", val)} defaultValue={watch("moveSize")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select home size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="studio">Studio Apartment</SelectItem>
                    <SelectItem value="1br">1 Bedroom Home</SelectItem>
                    <SelectItem value="2br">2 Bedroom Home</SelectItem>
                    <SelectItem value="3br">3 Bedroom Home</SelectItem>
                    <SelectItem value="4br+">4+ Bedroom Home</SelectItem>
                    <SelectItem value="commercial">Commercial/Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialItems">Special Items (Optional)</Label>
                <Textarea 
                  id="specialItems" 
                  {...register("specialItems")} 
                  placeholder="Piano, Pool Table, Fine Art, Gun Safe, etc." 
                  className="min-h-[120px]"
                />
              </div>
            </div>
          )}

          {/* Step 3: Contact */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><User className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Who should we contact?</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register("name")} placeholder="John Doe" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register("email")} placeholder="john@example.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" {...register("phone")} placeholder="(555) 000-0000" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><Package className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Review Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">From</p>
                  <p className="font-bold text-primary">{watch("pickupZip")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">To</p>
                  <p className="font-bold text-primary">{watch("dropoffZip")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Date</p>
                  <p className="font-bold text-primary">{watch("moveDate")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Size</p>
                  <p className="font-bold text-primary capitalize">{watch("moveSize")}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Contact</p>
                  <p className="font-bold text-primary">{watch("name")} • {watch("phone")}</p>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-xl text-xs text-primary leading-relaxed">
                By clicking "Submit Request", you agree to our terms of service and consent to being contacted by our moving specialists.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-12">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={prevStep} className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : <div />}

            {step < totalSteps ? (
              <Button type="button" onClick={nextStep} className="bg-primary rounded-full px-8 flex items-center gap-2">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-12 text-lg font-bold">
                Submit Request
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
