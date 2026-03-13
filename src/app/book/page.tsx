import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Truck, ShieldCheck, MapPin, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

export default function BookingPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                <Star className="h-3 w-3 fill-current" />
                Guaranteed Availability in 51 Regions
              </div>
              <h1 className="text-5xl md:text-8xl font-black text-primary uppercase tracking-tighter leading-tight">
                SECURE YOUR <span className="text-accent">MOVE</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Ready to commit to your new journey? Lock in your professional moving crew and logistics plan today.
              </p>
            </div>

            {/* Booking Options Grid */}
            <div className="grid md:grid-cols-2 gap-8 mt-16">
              <Card className="border-none shadow-2xl bg-white overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                <div className="h-2 bg-primary" />
                <CardContent className="p-10 space-y-6">
                  <div className="bg-primary/5 p-4 rounded-2xl w-fit text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-primary uppercase tracking-tight">Schedule Your Date</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Select your moving window and get an instant professional quote based on your specific inventory and distance.
                    </p>
                  </div>
                  <Button asChild className="w-full bg-primary hover:bg-primary/90 rounded-xl h-14 text-lg font-bold group-hover:gap-4 transition-all">
                    <Link href="/quote">
                      Start My Quote <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl bg-white overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                <div className="h-2 bg-accent" />
                <CardContent className="p-10 space-y-6">
                  <div className="bg-accent/5 p-4 rounded-2xl w-fit text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-primary uppercase tracking-tight">Premium White-Glove</h3>
                    <div className="flex gap-1 text-accent">
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Need a full-service transition? We'll handle every box, wrap every antique, and assemble every bed.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="w-full rounded-xl h-14 text-lg font-bold border-accent text-accent hover:bg-accent hover:text-white transition-all">
                    <Link href="/services">Explore Premium Add-ons</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Why Book With Us Section */}
            <div className="bg-primary text-white p-12 rounded-3xl shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="relative z-10 grid md:grid-cols-3 gap-12 text-center">
                <div className="space-y-3">
                  <h4 className="text-accent text-4xl font-black">51,000</h4>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60">Vetted Professionals</p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-accent text-4xl font-black">24/7</h4>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60">Logistics Support</p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-accent text-4xl font-black">100%</h4>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60">Bonded & Insured</p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
            </div>

            {/* Contact CTA */}
            <div className="text-center pt-8">
              <p className="text-muted-foreground mb-4">Questions before you book?</p>
              <Link href="/contact" className="text-primary font-black uppercase tracking-widest text-xs hover:text-accent transition-colors flex items-center justify-center gap-2">
                Talk to a Move Coordinator <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
