"use client";

import { ProviderLayout } from "@/components/layout/provider-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Tags, DollarSign, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { AVAILABLE_SERVICES } from "@/lib/services";

const pricingSchema = z.object({
  hourlyRate: z.coerce.number().min(15, "Minimum rate is $15/hr"),
  minimumHours: z.coerce.number().min(1, "Minimum 1 hour"),
  services: z.array(z.string()).min(1, "Must select at least one service")
});

type PricingFormValues = z.infer<typeof pricingSchema>;



export default function ProviderServicesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const providerRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "providers", user.uid);
  }, [firestore, user]);

  const { data: providerDoc, isLoading } = useDoc(providerRef);

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      hourlyRate: 50,
      minimumHours: 2,
      services: [],
    },
  });

  useEffect(() => {
    if (providerDoc) {
      form.reset({
        hourlyRate: providerDoc.hourlyRate || 50,
        minimumHours: providerDoc.minimumHours || 2,
        services: providerDoc.services || [],
      });
    }
  }, [providerDoc, form]);

  const onSubmit = async (data: PricingFormValues) => {
    if (!providerRef) return;
    setIsSaving(true);
    try {
      await updateDoc(providerRef, {
        hourlyRate: data.hourlyRate,
        minimumHours: data.minimumHours,
        services: data.services,
      });
      toast({
        title: "Success",
        description: "Pricing and services updated successfully!",
      });
    } catch (error) {
      console.error("Error updating pricing:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update pricing.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ProviderLayout>
        <div className="p-20 text-center animate-pulse font-black text-muted-foreground uppercase tracking-widest text-xs">
          Loading Data...
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <header>
          <h1 className="text-3xl font-black text-slate-900 uppercase">Services & <span className="text-accent">Pricing</span></h1>
          <p className="text-muted-foreground">Define what you do and how much you charge to let customers book you directly.</p>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-accent" /> Hourly Rates</CardTitle>
                <CardDescription>Set your standard hourly base rate and minimum booking hours.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Hourly Rate ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input type="number" placeholder="50" className="pl-10 h-14 text-lg font-bold" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minimumHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Minimum Booking (Hours)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2" className="h-14 text-lg font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tags className="w-5 h-5 text-accent" /> Offered Services</CardTitle>
                <CardDescription>Select the services customers can book you for at your hourly rate.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="services"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {AVAILABLE_SERVICES.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="services"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 hover:bg-slate-50 transition-colors"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.label)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, item.label])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== item.label
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-medium text-sm leading-none cursor-pointer">
                                    {item.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage className="mt-4" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} className="bg-accent hover:bg-accent/90 h-14 px-10 rounded-full font-black uppercase tracking-widest text-xs shadow-lg shadow-accent/20">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Pricing Overview</>}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </ProviderLayout>
  );
}
