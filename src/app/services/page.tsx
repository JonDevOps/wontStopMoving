import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Truck, 
  MapPin, 
  Warehouse, 
  Package, 
  ShieldCheck, 
  Clock,
  Briefcase,
  ChevronRight,
  ArrowRight,
  Shield,
  GraduationCap,
  Hammer,
  Sparkles,
  Trash2,
  Wrench,
  Hotel,
  Server,
  Building2,
  Boxes,
  Lock,
  Music
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ServicesPage() {
  const mainServices = [
    {
      title: "Local Moving",
      desc: "Stress-free relocation within your city or state. Our local teams know your neighborhood inside and out, ensuring a quick and efficient move.",
      icon: Truck,
      features: ["Same-day service available", "Expert packing & unpacking", "Furniture disassembly & assembly"],
      href: "/services/local-moving"
    },
    {
      title: "Long Distance",
      desc: "Crossing state lines or moving across the country? Our nationwide network handles the logistics of your long-haul journey with precision.",
      icon: MapPin,
      features: ["Dedicated moving coordinators", "GPS tracking on all trucks", "Full valuation protection"],
      href: "/services/long-distance"
    },
    {
      title: "Commercial & Office",
      desc: "Specialized solutions for businesses of all sizes. We minimize downtime and ensure your workspace is set up exactly as needed.",
      icon: Briefcase,
      features: ["IT & equipment handling", "After-hours moving options", "Cubicle installation"],
      href: "/services"
    },
    {
      title: "Gun Safe Moving",
      desc: "Heavy-duty logistics for your most secure assets. We use specialized equipment to move safes of all sizes without damaging your floors or the safe itself.",
      icon: Lock,
      features: ["Motorized stair-climbing dollies", "Industrial floor protection", "Secure & discreet transit"],
      href: "/services"
    },
    {
      title: "Piano Moving",
      desc: "Precision moving for delicate instruments. From uprights to concert grands, we handle the complex acoustics and weight distribution of every piano.",
      icon: Music,
      features: ["Custom piano boards & padding", "Humidity-controlled transit", "Tuning coordination available"],
      href: "/services"
    },
    {
      title: "Hospitality Services",
      desc: "Comprehensive FF&E logistics for hotels, resorts, and restaurants. We manage the delicate transition of your hospitality assets with precision.",
      icon: Hotel,
      features: ["FF&E installation specialists", "Model room setup", "Liquidation management"],
      href: "/services"
    },
    {
      title: "Data Center Moving",
      desc: "High-security transport for mission-critical infrastructure. Specialized handling for servers, rack systems, and sensitive electronic components.",
      icon: Server,
      features: ["Climate-controlled transport", "Anti-static packaging", "Secure chain of custody"],
      href: "/services"
    },
    {
      title: "Workplace Solutions",
      desc: "End-to-end management for modern workspaces. From decommissioning old offices to configuring new collaborative environments.",
      icon: Building2,
      features: ["Asset decommissioning", "Space planning & design", "Furniture reconfiguration"],
      href: "/services"
    },
    {
      title: "Warehousing & Logistics",
      desc: "A complete supply chain partner. We handle the heavy lifting of your backend operations with a focus on speed and accuracy.",
      icon: Boxes,
      features: ["Procurement & Sourcing", "Advanced Inventory Management", "Custom Packaging & Distribution", "Real-time supply chain tracking"],
      href: "/services"
    },
    {
      title: "Military Relocation",
      desc: "Specialized PCS support for our service members. We understand the unique requirements and timelines of military relocations.",
      icon: Shield,
      features: ["PCS compliant documentation", "Base access approved teams", "Flexible scheduling for orders"],
      href: "/services"
    },
    {
      title: "Student Moves",
      desc: "Affordable and flexible moving solutions for college students. Perfect for dorm relocations or moving into your first apartment.",
      icon: GraduationCap,
      features: ["Dorm-friendly logistics", "Small load specialists", "Budget-conscious pricing"],
      href: "/services"
    },
    {
      title: "White-Glove Packing",
      desc: "The ultimate convenience. We handle everything from wrapping fragile china to professional unpacking and organization in your new home.",
      icon: Package,
      features: ["All materials included", "Systematic labeling", "Room-by-room unpacking"],
      href: "/services"
    },
    {
      title: "Specialty Crating",
      desc: "Custom-built wooden crates for high-value items like fine art, antiques, and large electronics, ensuring maximum protection during transit.",
      icon: Hammer,
      features: ["On-site crate building", "Fine art handling experts", "Secure bracing for electronics"],
      href: "/services"
    },
    {
      title: "Cleaning Services",
      desc: "Step into a fresh start. We provide deep move-in and move-out cleaning services, handling the scrubbing so you don't have to.",
      icon: Sparkles,
      features: ["Deep kitchen & bath cleaning", "Security deposit guarantee", "Eco-friendly products"],
      href: "/services"
    },
    {
      title: "Junk Removal",
      desc: "Declutter your life before or after the move. We'll haul away unwanted items and ensure they're donated or recycled responsibly.",
      icon: Trash2,
      features: ["Same-day haul away", "Donation receipt provided", "Responsible disposal"],
      href: "/services"
    },
    {
      title: "Handyman & Assembly",
      desc: "From assembling complex IKEA furniture to mounting TVs and hanging mirrors, our team ensures your new house feels like home on day one.",
      icon: Wrench,
      features: ["TV wall mounting", "Shelving installation", "Expert furniture assembly"],
      href: "/services"
    },
    {
      title: "Vaulted Storage",
      desc: "Climate-controlled, secure storage in individual wooden vaults. Your belongings stay protected, clean, and safe for as long as you need.",
      icon: Warehouse,
      features: ["24/7 security monitoring", "Climate & humidity control", "Inventory tracking"],
      href: "/services"
    },
    {
      title: "Express Moving",
      desc: "For when time is of the essence. Priority scheduling and dedicated transport for urgent relocation needs nationwide.",
      icon: Clock,
      features: ["Guaranteed delivery dates", "Direct non-stop transit", "Last-minute availability"],
      href: "/services"
    }
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              OUR <span className="text-accent">SERVICES</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              From premium residential packing to complex nationwide enterprise logistics, we provide a full suite of relocation solutions tailored to your scale.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 rounded-full px-12 h-16 text-xl font-bold">
                <Link href="/quote">Get Your Free Quote</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Detailed Services Grid */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {mainServices.map((service, i) => (
                <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                  <div className="h-48 relative overflow-hidden">
                    <Image 
                      src={`https://picsum.photos/seed/service${i}/800/400`}
                      alt={service.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-primary/40 group-hover:bg-primary/20 transition-colors" />
                    <div className="absolute top-6 left-6 bg-white p-3 rounded-xl text-primary shadow-lg">
                      <service.icon className="h-6 w-6" />
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-2xl font-black text-primary uppercase">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground leading-relaxed text-sm h-20 overflow-hidden">
                      {service.desc}
                    </p>
                    <ul className="space-y-2">
                      {service.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm font-bold text-primary">
                          <ChevronRight className="h-4 w-4 text-accent" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="ghost" className="p-0 h-auto text-accent font-black hover:bg-transparent hover:text-accent/80 group">
                      <Link href={service.href}>
                        Learn More <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-2 transition-transform" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Protection Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-primary text-white p-12 rounded-3xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="bg-accent p-6 rounded-full h-fit">
                  <ShieldCheck className="h-12 w-12" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl font-black uppercase">Your Assets, Protected</h2>
                  <p className="text-white/70 leading-relaxed">
                    We offer comprehensive valuation protection for every move. From standard liability to full-value replacement coverage, your peace of mind is our top priority. Our teams are fully licensed, bonded, and insured in all 51 service regions.
                  </p>
                  <Button className="bg-white text-black hover:bg-white/90 rounded-full px-8 font-bold">
                    Review Protection Plans
                  </Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32" />
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
