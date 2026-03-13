import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users, Globe, Target, Award, Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  const values = [
    { title: "Nationwide Reliability", desc: "With 51,000 movers across 51 regions, we provide consistent, high-quality service from coast to coast.", icon: Globe },
    { title: "Transparency First", desc: "No hidden fees, no surprises. Our AI-driven quoting system ensures you know exactly what to expect.", icon: Shield },
    { title: "Customer Centric", desc: "Every move is unique. We tailor our logistics to fit your specific timeline and requirements.", icon: Heart },
    { title: "Professional Excellence", desc: "Our teams undergo rigorous training to handle everything from fine art to heavy industrial equipment.", icon: Award },
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              MOVING THE <span className="text-accent">NATION</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Wont Stop Moving is redefining relocation through technology, transparency, and a massive network of professional logistics experts.
            </p>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
              <div className="lg:w-1/2 space-y-6">
                <h2 className="text-4xl font-black text-primary uppercase">OUR STORY</h2>
                <div className="w-20 h-2 bg-accent" />
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Founded on the principle that moving shouldn't be a source of stress, Wont Stop Moving began as a local operation with a single truck and a big vision. We saw an industry plagued by fragmentation and lack of accountability.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Today, we have grown into a logistics powerhouse covering all 50 states and Puerto Rico. Our 51 regions are managed by local experts who understand the unique challenges of their geography, backed by the standards and technology of a national leader.
                </p>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-12 font-bold">
                    <Link href="/careers">Join Our 51,000 Strong Team</Link>
                  </Button>
                </div>
              </div>
              <div className="lg:w-1/2 relative">
                <div className="aspect-square relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/about1/800/800" 
                    alt="Team working together" 
                    fill 
                    className="object-cover"
                    data-ai-hint="team moving"
                  />
                </div>
                <div className="absolute -bottom-10 -left-10 bg-accent p-8 rounded-3xl text-white hidden md:block">
                  <div className="text-4xl font-black">10+</div>
                  <div className="text-sm font-bold uppercase tracking-widest">Years of Excellence</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-primary mb-4 uppercase">OUR CORE VALUES</h2>
              <div className="w-24 h-2 bg-accent mx-auto" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, i) => (
                <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-8 text-center">
                    <div className="bg-primary/5 text-primary p-4 rounded-2xl w-fit mx-auto mb-6">
                      <value.icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-primary mb-3">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                { label: "Active Movers", value: "51,000+" },
                { label: "Service Regions", value: "51" },
                { label: "States Covered", value: "50 + PR" },
                { label: "Happy Customers", value: "1M+" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl font-black text-accent mb-2">{stat.value}</div>
                  <div className="text-sm font-bold text-primary uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
