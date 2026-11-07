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
import { FAQ_CATEGORIES } from '@/lib/faq-data';

export default function FAQPage() {
  const icons = [Truck, Package, MapPin, ShieldCheck];
  const faqCategories = FAQ_CATEGORIES.map((c, i) => ({ ...c, icon: icons[i] }));

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
