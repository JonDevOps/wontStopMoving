import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  Lock,
  ThermometerSun,
  Zap,
  Navigation
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function DataCenterMovingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Mission-Critical Infrastructure
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                DATA CENTER <span className="text-accent">TRANSIT</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Relocating high-value server infrastructure requires a masterclass in security, climate control, and anti-static protocols. We ensure your mission-critical data remains secure and operational.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Tech Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Server className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Anti-Static", desc: "Specialized packaging materials to prevent ESD damage during transit.", icon: Zap },
                { title: "Climate Control", desc: "Temperature-monitored vehicles to protect sensitive electronics.", icon: ThermometerSun },
                { title: "Chain of Custody", desc: "End-to-end security protocols and asset verification for every rack.", icon: Lock },
                { title: "Rack Migration", desc: "Expert handling of populated and unpopulated server rack systems.", icon: Server },
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
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
              <div className="lg:w-1/2 relative">
                <div className="aspect-video relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image 
                    src="https://picsum.photos/seed/server/1200/800" 
                    alt="Server room transition" 
                    fill 
                    className="object-cover"
                    data-ai-hint="server rack"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">INFRASTRUCTURE <span className="text-accent">SECURITY</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Moving a data center is not just about moving hardware; it's about moving your organization's digital pulse. Our teams are background-checked and trained in high-security logistics.
                </p>
                <div className="grid gap-4">
                  {[
                    "Asset inventory and audit prior to loading",
                    "Customized insurance for high-value tech inventory",
                    "Secure, non-stop transit options available",
                    "Specialized shock-absorbent logistics platforms"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Security Team</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Navigation className="h-16 w-16 mx-auto animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">SECURE CHAIN OF CUSTODY</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Our nationwide network provides secure, tech-ready logistics in all 51 regions.
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
              <Link href="/book">Book Now</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
