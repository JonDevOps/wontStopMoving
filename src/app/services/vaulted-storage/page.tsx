import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { 
  Warehouse, 
  ShieldCheck, 
  CheckCircle2, 
  Lock,
  ThermometerSun,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function VaultedStoragePage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
                Secured Climate Control
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
                VAULTED <span className="text-accent">STORAGE</span>
              </h1>
              <p className="text-xl opacity-80 mb-10 leading-relaxed">
                Climate-controlled, secure storage in individual wooden vaults. Your belongings stay protected, clean, and safe for as long as you need in our 51 regional facilities.
              </p>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-10 h-16 text-lg font-bold">
                <Link href="/quote">Start Storage Quote</Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 hidden lg:block">
            <Warehouse className="w-[600px] h-[600px]" />
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Individual Vaults", desc: "Private 5x7x7 wooden vaults that minimize handling and exposure.", icon: Lock },
                { title: "Climate Control", desc: "Humidity and temperature-monitored facilities nationwide.", icon: ThermometerSun },
                { title: "24/7 Security", desc: "Advanced surveillance and motion-sensor protection for your assets.", icon: ShieldCheck },
                { title: "Inventory Mgmt", desc: "Digital tracking of every item stored within our vaulted network.", icon: ClipboardList },
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
                    src="https://picsum.photos/seed/storage/1200/800" 
                    alt="Inside a secure storage facility" 
                    fill 
                    className="object-cover"
                    data-ai-hint="storage facility"
                  />
                </div>
              </div>
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">SAFE & <span className="text-accent">SOUND</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Unlike traditional self-storage, our vaulted system minimizes the physical handling of your items. Once your belongings are packed into a vault at your home, they stay in that vault within our secure facility until you're ready for delivery.
                </p>
                <div className="grid gap-4">
                  {[
                    "Short-term and long-term storage options available",
                    "Direct delivery from vault to your new doorstep",
                    "Full value protection available for stored goods",
                    "Dust-free, clean, and temperature-stable environments"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-bold text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Button asChild className="rounded-full bg-primary px-8 h-14 font-bold">
                    <Link href="/book">Reserve Storage Space</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-secondary text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <Warehouse className="h-16 w-16 mx-auto text-accent" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">YOUR ASSETS, SECURED</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-80 leading-relaxed">
              Our 51 regional hubs provide professional storage solutions that bridge the gap between moves.
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
