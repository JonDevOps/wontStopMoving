"use client";

import { PublicLayout } from '@/components/layout/public-layout';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  Package, 
  ShieldCheck, 
  MapPin, 
  MessageSquare 
} from 'lucide-react';
import Link from 'next/link';

export default function FAQPage() {
  const faqCategories = [
    {
      title: "Booking & Quotes",
      icon: Truck,
      items: [
        {
          q: "How do I get a free moving quote?",
          a: "Getting a quote is simple! Click the 'Get a Quote' button at the top of any page. Our AI-driven system will ask for your pickup/dropoff zip codes, move size, and date to provide a professional estimate in minutes."
        },
        {
          q: "Are your quotes binding?",
          a: "We primarily offer 'Binding Not-to-Exceed' quotes. This means you will never pay more than your original estimate for the services and inventory listed, but if your shipment weighs less than expected, you'll actually pay less. It's the most transparent pricing model in the industry."
        },
        {
          q: "How far in advance should I book my move?",
          a: "For local moves, we recommend booking 4-6 weeks in advance. For nationwide or long-distance moves (especially during the peak summer season), try to book 8-12 weeks early to ensure your preferred dates and our top-rated crew leads are available."
        }
      ]
    },
    {
      title: "Packing & Services",
      icon: Package,
      items: [
        {
          q: "Do you offer professional packing services?",
          a: "Yes! Our 'White-Glove Packing' service covers everything from wrapping individual pieces of china to professional organization in your new home. We provide all high-quality materials and our teams are trained in specialized techniques for maximum protection."
        },
        {
          q: "Can you move high-value or fragile items?",
          a: "Absolutely. We specialize in 'Specialty Crating' for items like grand pianos, fine art, antiques, and complex electronics. We build custom wooden crates on-site to ensure museum-quality protection during transit."
        },
        {
          q: "Do you provide moving boxes and tape?",
          a: "If you choose our packing service, all materials are included. If you're packing yourself, you can purchase high-quality moving kits directly through our portal, or ask about our eco-friendly rental bin system."
        }
      ]
    },
    {
      title: "Logistics & Coverage",
      icon: MapPin,
      items: [
        {
          q: "Which regions do you serve?",
          a: "Wont Stop Moving operates in all 50 US states plus Canada. We have dedicated local teams in every region to provide local expertise with nationwide logistics standards."
        },
        {
          q: "Can I track my moving truck in real-time?",
          a: "Yes. Every 26-foot vehicle in our national fleet is equipped with GPS telematics. You can log in to your Customer Portal to see the real-time location and estimated arrival time of your shipment."
        },
        {
          q: "What happens if there is bad weather on moving day?",
          a: "Our 51,000 professionals are trained in 'Adverse Weather Protocols.' We use specialized floor runners, industrial shrink-wrap, and canopy systems to keep your items dry and your floors clean during rain or snow. Your safety and the protection of your assets are our priority."
        }
      ]
    },
    {
      title: "Protection & Payments",
      icon: ShieldCheck,
      items: [
        {
          q: "What kind of insurance protection do you provide?",
          a: "We offer full Valuation Protection. Standard Released Value Protection is included at no extra cost, but we highly recommend our Full Value Replacement plan for total peace of mind. Our specialists can walk you through the details of each plan."
        },
        {
          q: "What payment methods do you accept?",
          a: "We accept all major credit cards, bank transfers, and offer flexible financing options through our partners for premium service packages. All payments are processed securely through our digital portal."
        },
        {
          q: "Should I tip my moving crew?",
          a: "Tipping is never required but always appreciated for exceptional service. If you choose to tip, a standard range is $5-$10 per hour per mover, or a flat amount based on the complexity of the move. You can tip in cash or add it to your final digital invoice."
        }
      ]
    }
  ];

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* FAQ Hero */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              HOW CAN WE <span className="text-accent">HELP?</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Find answers to the most common questions about our nationwide logistics and premium moving services.
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-12 gap-16">
              {/* Sidebar Navigation (Desktop) */}
              <aside className="hidden lg:block lg:col-span-3">
                <div className="sticky top-32 space-y-4">
                  <h3 className="text-xs font-black text-accent uppercase tracking-widest mb-6">Categories</h3>
                  {faqCategories.map((cat, i) => (
                    <button 
                      key={i}
                      onClick={() => document.getElementById(`cat-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="flex items-center gap-3 w-full text-left p-4 rounded-xl font-bold text-primary hover:bg-gray-50 transition-colors group"
                    >
                      <cat.icon className="h-5 w-5 text-accent" />
                      {cat.title}
                    </button>
                  ))}
                </div>
              </aside>

              {/* Accordions */}
              <div className="lg:col-span-9 space-y-16">
                {faqCategories.map((category, catIdx) => (
                  <div key={catIdx} id={`cat-${catIdx}`} className="space-y-8 animate-fade-in">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                        <category.icon className="h-8 w-8" />
                      </div>
                      <h2 className="text-3xl font-black text-primary uppercase">{category.title}</h2>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item, itemIdx) => (
                        <AccordionItem key={itemIdx} value={`item-${catIdx}-${itemIdx}`} className="border-b border-gray-100 py-2">
                          <AccordionTrigger className="text-left text-lg font-bold text-primary hover:text-accent hover:no-underline transition-colors">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground leading-relaxed text-base pt-2 pb-6">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Still Have Questions? */}
        <section className="py-24 bg-gray-50 border-t">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-primary text-white p-12 rounded-3xl text-center space-y-8 shadow-2xl shadow-primary/20">
              <MessageSquare className="h-16 w-16 text-accent mx-auto" />
              <h2 className="text-4xl font-black uppercase tracking-tighter">STILL HAVE QUESTIONS?</h2>
              <p className="text-xl text-white/70 max-w-xl mx-auto">
                Our logistics specialists are available 24/7 to help you plan your perfect move across any of our service regions.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white rounded-full px-10 h-14 font-black uppercase tracking-widest text-xs">
                  <Link href="/contact">Contact Support</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-10 h-14 font-black uppercase tracking-widest text-xs">
                  <Link href="/quote">Get Instant Quote</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
