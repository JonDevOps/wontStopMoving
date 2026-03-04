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
  ChevronRight
} from 'lucide-react';

export default function CareersPage() {
  const benefits = [
    { title: "Competitive Pay", desc: "Top-tier hourly rates + generous tips from customers.", icon: DollarSign },
    { title: "Flexible Schedule", icon: Calendar, desc: "Choose your own shifts and work when it suits you." },
    { title: "Nationwide Growth", icon: MapPin, desc: "Opportunities to transfer to any of our 51 regions." },
    { title: "Full Benefits", icon: Heart, desc: "Health, dental, and vision for full-time employees." },
    { title: "Career Training", icon: Award, desc: "Professional development and advancement opportunities." },
    { title: "Team Culture", icon: Briefcase, desc: "Join a supportive community of 51,000 movers." }
  ];

  return (
    <div className="min-h-screen">
      {/* Careers Hero */}
      <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-sm font-bold mb-6 animate-pulse">
            HIRING NATIONWIDE
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
            JOIN OUR TEAM OF <span className="text-accent">51,000</span> MOVERS
          </h1>
          <p className="text-xl opacity-80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Build your career with the nation's fastest-growing moving company. We're hiring in every state and Puerto Rico.
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-12 h-16 text-xl font-black">
            <Link href="/careers/apply">APPLY NOW</Link>
          </Button>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent opacity-30" />
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-primary mb-4 uppercase">WHY WORK WITH US?</h2>
            <div className="w-24 h-2 bg-accent mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, i) => (
              <Card key={i} className="border-none bg-gray-50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-8">
                  <div className="bg-primary text-white p-3 rounded-xl w-fit mb-6">
                    <benefit.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-3">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{benefit.desc}</p>
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
              <h2 className="text-4xl font-black mb-4 uppercase">OPEN POSITIONS</h2>
              <p className="opacity-60 max-w-xl">Browse available roles across all 51 regions. We hire for entry-level moving staff to regional operations managers.</p>
            </div>
            <div className="w-full md:w-64">
              <label className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2 block">Filter by State</label>
              <select className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">All Regions</option>
                <option value="TX">Texas (1,024 slots)</option>
                <option value="NY">New York (842 slots)</option>
                <option value="CA">California (1,230 slots)</option>
                <option value="PR">Puerto Rico (150 slots)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              { title: "Professional Mover", region: "Nationwide", type: "Full Time / Part Time", pay: "$18-25/hr + Tips" },
              { title: "Moving Lead / Driver", region: "Multiple Regions", type: "Full Time", pay: "$22-30/hr + Tips" },
              { title: "CDL Class A Driver", region: "Long Distance Hubs", type: "Full Time", pay: "$35-45/hr" },
              { title: "Regional Ops Manager", region: "Dallas, TX", type: "Full Time", pay: "Salary DOE" }
            ].map((job, i) => (
              <div key={i} className="group bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center hover:bg-white/10 transition-colors cursor-pointer">
                <div className="mb-4 md:mb-0">
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-accent transition-colors">{job.title}</h3>
                  <div className="flex flex-wrap gap-4 text-sm opacity-60">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.region}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {job.type}</span>
                    <span className="flex items-center gap-1 font-bold text-accent">{job.pay}</span>
                  </div>
                </div>
                <Button asChild className="rounded-full bg-accent hover:bg-accent/90 px-8 text-white font-bold">
                  <Link href="/careers/apply">Apply Now</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
