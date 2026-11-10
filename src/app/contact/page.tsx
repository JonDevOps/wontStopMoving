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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleInquirySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    const form = e.currentTarget;
    const field = (id: string) => (form.elements.namedItem(id) as HTMLInputElement | null)?.value?.trim() || "";
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/support', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(['name', 'email', 'phone', 'subject', 'message', 'website'].map(key => [key, field(key)]))),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your message. Please try again.');
      setTicketId(result.ticketId);
      setSubmitted(true);
      toast({ title: 'Message received', description: 'Your enquiry has been saved for our support team.' });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to send your message. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  const serviceAreas = [
    'Boston, Massachusetts', 'New York, New York', 'Philadelphia, Pennsylvania',
    'Cleveland, Ohio', 'Richmond, Virginia', 'Atlanta, Georgia', 'Chicago, Illinois',
    'St. Louis, Missouri', 'Minneapolis, Minnesota', 'Kansas City, Missouri',
    'Dallas, Texas', 'San Francisco, California', 'Vancouver, British Columbia',
    'Calgary, Alberta', 'Toronto, Ontario', 'Montreal, Quebec', 'Halifax, Nova Scotia',
  ];

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Contact Form */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-primary uppercase mb-4">SEND A MESSAGE</h2>
                  <p className="text-muted-foreground">Send your enquiry directly to our support team. We’ll reply to the email address you provide.</p>
                </div>
                
                <Card className="border-none shadow-xl bg-gray-50">
                  <CardContent className="p-8">
                    {submitted ? (
                      <div className="py-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-black text-primary uppercase">Message Received</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Your enquiry is saved. Our support team will review it and reply by email. Your reference is {ticketId}.
                        </p>
                        <Button variant="outline" onClick={() => setSubmitted(false)} className="rounded-full font-bold">
                          Send Another Message
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleInquirySubmit} className="space-y-6">
                        <div hidden aria-hidden="true">
                          <label htmlFor="website">Leave this field empty</label>
                          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" required minLength={2} maxLength={120} placeholder="John Doe" className="bg-white border-gray-200 h-12" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" required maxLength={254} placeholder="john@example.com" className="bg-white border-gray-200 h-12" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input id="phone" type="tel" maxLength={40} placeholder="(555) 000-0000" className="bg-white border-gray-200 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input id="subject" required minLength={2} maxLength={200} placeholder="Question about my quote" className="bg-white border-gray-200 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="message">Message</Label>
                          <Textarea id="message" required minLength={10} maxLength={5000} placeholder="How can we help you today?" className="bg-white border-gray-200 min-h-[150px]" />
                        </div>
                        {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 font-bold uppercase tracking-widest">
                          {isSubmitting ? 'Sending…' : 'Submit Inquiry'}
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
                        <p className="text-xl font-bold text-primary break-all">support@wontstopmoving.com</p>
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

                <div className="space-y-6">
                  <h3 className="text-xl font-black text-primary uppercase">SERVICE AREAS</h3>
                  <p className="text-muted-foreground">Contact us to confirm crew availability and scheduling for your route.</p>
                  <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-accent">
                    {serviceAreas.map((area) => (
                      <div key={area} className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4 hover:bg-gray-100 transition-colors border border-transparent hover:border-accent/10">
                        <MapPin className="h-5 w-5 text-accent shrink-0" />
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary">{area}</p>
                          <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">Service area</span>
                        </div>
                      </div>
                    ))}
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
