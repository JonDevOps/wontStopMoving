"use client";

import { useState } from 'react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare, 
  Clock, 
  ChevronRight,
  Globe,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Opens the visitor's email app with their message to our support inbox.
    const form = e.currentTarget;
    const field = (id: string) => (form.elements.namedItem(id) as HTMLInputElement | null)?.value?.trim() || "";
    const body = [
      `Name: ${field("name")}`,
      `Email: ${field("email")}`,
      field("phone") ? `Phone: ${field("phone")}` : "",
      "",
      field("message"),
    ].filter((line, i) => line !== "" || i === 3).join("\n");
    window.location.href = `mailto:support@wontstopmoving.com?subject=${encodeURIComponent(field("subject") || "Website inquiry")}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
    toast({
      title: "Opening your email app",
      description: "Send the email to reach our support team. We'll reply as soon as we can.",
    });
  };

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              GET IN <span className="text-accent">TOUCH</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Have questions about your upcoming move or about working with us? We're here to help.
            </p>
          </div>
        </section>

        {/* Contact Form & Info */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16">
              {/* Contact Form */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-primary uppercase mb-4">SEND A MESSAGE</h2>
                  <p className="text-muted-foreground">Fill out the form below and it will open an email to our support team.</p>
                </div>
                
                <Card className="border-none shadow-xl bg-gray-50">
                  <CardContent className="p-8">
                    {submitted ? (
                      <div className="py-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-black text-primary uppercase">Almost Done!</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Your email app should have opened with your message to support@wontstopmoving.com. Press send there and we'll get back to you as soon as we can.
                        </p>
                        <Button variant="outline" onClick={() => setSubmitted(false)} className="rounded-full font-bold">
                          Send Another Message
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleInquirySubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" required placeholder="John Doe" className="bg-white border-gray-200 h-12" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" required placeholder="john@example.com" className="bg-white border-gray-200 h-12" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input id="phone" type="tel" placeholder="(555) 000-0000" className="bg-white border-gray-200 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input id="subject" required placeholder="Question about my quote" className="bg-white border-gray-200 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="message">Message</Label>
                          <Textarea id="message" required placeholder="How can we help you today?" className="bg-white border-gray-200 min-h-[150px]" />
                        </div>
                        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 font-bold uppercase tracking-widest">
                          Submit Inquiry
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Contact Info Sidebar */}
              <div className="space-y-12">
                <div className="space-y-8">
                  <h2 className="text-3xl font-black text-primary uppercase">CONTACT DETAILS</h2>
                  
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="bg-accent text-white p-3 rounded-2xl h-fit">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Call Us</p>
                        <p className="text-xl font-bold text-primary">(650) 569-0584</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="bg-primary text-white p-3 rounded-2xl h-fit">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Email Support</p>
                        <p className="text-xl font-bold text-primary">support@wontstopmoving.com</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-gray-100 text-primary p-3 rounded-2xl h-fit">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Business Hours</p>
                        <p className="text-xl font-bold text-primary">Email any time. We reply as soon as we can.</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4 text-center space-y-8">
            <MessageSquare className="h-16 w-16 text-accent mx-auto" />
            <h2 className="text-4xl font-black text-primary uppercase">NEED HELP?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Email our support team and we'll get back to you as soon as we can.
            </p>
            <Button
              size="lg"
              onClick={() => window.location.href = "mailto:support@wontstopmoving.com?subject=Live%20Support%20Request"}
              className="rounded-full bg-accent hover:bg-accent/90 px-12 h-16 text-xl font-bold"
            >
              Email Support
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
