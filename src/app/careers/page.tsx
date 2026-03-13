import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Clock,
  Heart,
  Award,
  ChevronRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';

export default function CareersPage() {
  const benefits = [
    { title: "Competitive Pay", desc: "Top-tier hourly rates + generous tips from customers. We believe in rewarding hard work.", icon: DollarSign },
    { title: "Flexible Schedule", icon: Calendar, desc: "Choose your own shifts and work when it suits you via our dynamic dispatch app." },
    { title: "Nationwide Growth", icon: MapPin, desc: "Opportunities to transfer to any of our 51 regions across 50 states and PR." },
    { title: "Full Benefits", icon: Heart, desc: "Comprehensive health, dental, and vision packages for all full-time employees." },
    { title: "Career Training", icon: Award, desc: "Paid training programs for leadership, CDL licensing, and logistics management." },
    { title: "Team Culture", icon: Briefcase, desc: "Join a supportive community of 51,000 movers committed to excellence." }
  ];

  return (
    <PublicLayout>
      <div className="min-h-screen">
        {/* Careers Hero */}
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-sm font-bold mb-6 animate-pulse">
              HIRING IN 51 REGIONS
            </div>
            <h1 className="text-5xl md:text-8xl font-black mb-6 uppercase tracking-tighter leading-tight">
              JOIN THE <span className="text-accent">MOVEMENT</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto mb-10 leading-relaxed">
              Build your career with the nation's fastest-growing logistics network. With 51,000 professionals, we're setting a new standard for moving.
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-12 h-16 text-xl font-black shadow-xl shadow-accent/20">
              <Link href="/careers/apply">APPLY TO JOIN</Link>
            </Button>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent opacity-30" />
        </section>

        {/* Impact Section */}
        <section className="py-24 bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center space-y-4">
                <div className="bg-primary/5 p-6 rounded-3xl w-fit mx-auto text-primary">
                  <TrendingUp className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black text-primary uppercase">GROWTH</h3>
                <p className="text-muted-foreground">85% of our regional managers started as entry-level movers. We promote from within.</p>
              </div>
              <div className="text-center space-y-4">
                <div className="bg-accent/5 p-6 rounded-3xl w-fit mx-auto text-accent">
                  <ShieldCheck className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black text-primary uppercase">SAFETY</h3>
                <p className="text-muted-foreground">Safety first, always. We provide premium gear and continuous safety certification training.</p>
              </div>
              <div className="text-center space-y-4">
                <div className="bg-primary/5 p-6 rounded-3xl w-fit mx-auto text-primary">
                  <Heart className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black text-primary uppercase">COMMUNITY</h3>
                <p className="text-muted-foreground">Every move helps a family start a new chapter. Be part of a meaningful service industry.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-primary mb-4 uppercase">WHY CHOOSE US?</h2>
              <div className="w-24 h-2 bg-accent mx-auto" />
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {benefits.map((benefit, i) => (
                <Card key={i} className="border-none bg-white shadow-sm hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="bg-primary text-white p-3 rounded-xl w-fit mb-6">
                      <benefit.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-primary mb-3">{benefit.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{benefit.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div>
                <h2 className="text-4xl font-black mb-4 uppercase leading-tight">OPEN POSITIONS <br /><span className="text-accent">NATIONWIDE</span></h2>
                <p className="opacity-60 max-w-xl">We are currently hiring in all 51 service regions. Whether you're looking for your first job or a career in logistics management, your journey starts here.</p>
              </div>
              <div className="w-full md:w-72">
                <label className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2 block text-white/40">Select Your Region</label>
                <select className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent appearance-none">
                  <option value="" className="bg-secondary text-white">All 51 Regions</option>
                  <option value="TX" className="bg-secondary text-white">Texas Regional Center</option>
                  <option value="NY" className="bg-secondary text-white">New York Operations</option>
                  <option value="CA" className="bg-secondary text-white">California Hub</option>
                  <option value="PR" className="bg-secondary text-white">Puerto Rico Logistics</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                { title: "Professional Mover", region: "All 51 Regions", type: "Full Time / Part Time", pay: "$20-28/hr + Tips" },
                { title: "Moving Crew Lead", region: "TX, NY, CA, FL", type: "Full Time", pay: "$25-35/hr + Tips" },
                { title: "CDL Logistics Driver", region: "National Fleet", type: "Full Time", pay: "$38-50/hr" },
                { title: "Regional Operations Manager", region: "Dallas / Mountain View", type: "Full Time", pay: "Salary DOE" }
              ].map((job, i) => (
                <div key={i} className="group bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center hover:bg-white/10 hover:border-accent/50 transition-all cursor-pointer">
                  <div className="mb-6 md:mb-0 space-y-3">
                    <h3 className="text-2xl font-bold group-hover:text-accent transition-colors">{job.title}</h3>
                    <div className="flex flex-wrap gap-6 text-sm opacity-60">
                      <span className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-accent" /> {job.region}</span>
                      <span className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-accent" /> {job.type}</span>
                      <span className="flex items-center gap-2 font-black text-white">{job.pay}</span>
                    </div>
                  </div>
                  <Button asChild className="rounded-full bg-accent hover:bg-accent/90 px-10 h-14 text-white font-black uppercase tracking-widest text-xs">
                    <Link href="/careers/apply">Apply Now</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Application CTA */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-black text-primary uppercase mb-6">READY TO MOVE YOUR CAREER FORWARD?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Our application process takes less than 5 minutes. Apply today and start your journey with Wont Stop Moving.
            </p>
            <Button asChild size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-12 h-16 text-xl font-bold">
              <Link href="/careers/apply">Submit Application</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
