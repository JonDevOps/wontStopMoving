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
  Globe
} from 'lucide-react';

export default function ContactPage() {
  const offices = [
    { name: "Global Headquarters", address: "855 Maude Ave, Mountain View CA 94043", type: "HQ" },
    { name: "Texas Regional Hub", address: "123 Dallas Logistics Way, Dallas TX 75201", type: "Regional" },
    { name: "New York Operations", address: "456 Manhattan Ave, New York NY 10001", type: "Regional" },
    { name: "Puerto Rico Center", address: "789 San Juan Blvd, San Juan PR 00901", type: "Regional" },
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
              Have questions about your upcoming move or want to learn more about our 51,000 strong mover network? We're here to help 24/7.
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
                  <p className="text-muted-foreground">Fill out the form below and one of our logistics specialists will get back to you within 60 minutes.</p>
                </div>
                
                <Card className="border-none shadow-xl bg-gray-50">
                  <CardContent className="p-8">
                    <form className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input id="name" placeholder="John Doe" className="bg-white border-gray-200 h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input id="email" type="email" placeholder="john@example.com" className="bg-white border-gray-200 h-12" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" placeholder="(555) 000-0000" className="bg-white border-gray-200 h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input id="subject" placeholder="Question about my quote" className="bg-white border-gray-200 h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea id="message" placeholder="How can we help you today?" className="bg-white border-gray-200 min-h-[150px]" />
                      </div>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-14 font-bold uppercase tracking-widest">
                        Submit Inquiry
                      </Button>
                    </form>
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
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Call Us 24/7</p>
                        <p className="text-xl font-bold text-primary">1-800-MOVE-NOW</p>
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
                        <p className="text-xl font-bold text-primary">Always Open. 24/7/365</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black text-primary uppercase">REGIONAL OFFICES</h3>
                  <div className="grid gap-4">
                    {offices.map((office, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-2xl flex items-start gap-4 hover:bg-gray-100 transition-colors">
                        <MapPin className="h-5 w-5 text-accent shrink-0 mt-1" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-primary">{office.name}</p>
                            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">{office.type}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{office.address}</p>
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
            <h2 className="text-4xl font-black text-primary uppercase">LIVE CHAT AVAILABLE</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Need immediate assistance? Our AI-powered chat and live human agents are ready to help you in any of our 51 regions.
            </p>
            <Button size="lg" className="rounded-full bg-accent hover:bg-accent/90 px-12 h-16 text-xl font-bold">
              Start Live Chat
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
