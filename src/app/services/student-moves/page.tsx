import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  ShieldCheck, 
  CheckCircle2, 
  Clock,
  DollarSign,
  ArrowRight,
  Package
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function StudentMovesPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Smart Campus Logistics
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                STUDENT <span className="text-accent">MOVES</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Relocating for the semester shouldn't break your budget. Wont Stop Moving offers flexible, small-load solutions designed for students and campus life.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Get Student Rate</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <GraduationCap className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Budget Friendly", desc: "Transparent, hourly rates with no hidden campus fees.", icon: DollarSign },
                { title: "Dorm Delivery", desc: "Teams experienced in tight dorm elevators and small spaces.", icon: Package },
                { title: "Quick Turnaround", desc: "Same-day and next-day options for fast semester transitions.", icon: Clock },
                { title: "Safe Storage", desc: "Temporary vaulted storage for summer breaks or internships.", icon: GraduationCap },
              ].map((feature, i) => (
                <div key={i} className="space-y-4 group">
                  <div className="bg-primary/5 p-4 rounded-2xl w-fit group-hover:bg-accent group-hover:text-white transition-colors">
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-primary uppercase">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/student/1200/800" 
                    alt="Student moving into a dorm" 
                    fill 
                    className="object-cover"
                    data-ai-hint="student moving"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">CAMPUS <span className="text-accent">READY</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Moving into a dorm or your first apartment is a milestone. We handle the logistics of your move—from navigating tight campus streets to assembling your new desk—so you can focus on your studies.
                </p>
                <div className="grid gap-4">
                  {[
                    "Small load specialists for studio and dorm sizes",
                    "Flexible scheduling around finals and start dates",
                    "Vetted, uniformed crews for student safety",
                    "GPS tracking for parents' peace of mind"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Book Student Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <GraduationCap className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">SMARTER STUDENT MOVING</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Serving every major university town across all 51 regions. Your academic journey starts here.
            </p>
            <div className="flex justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
                <Link href="/book">Book Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
