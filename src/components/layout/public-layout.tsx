"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Truck, Menu, X, ArrowRight, ChevronDown } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: "/services", label: "Services" },
    { href: "/services/types-of-moves", label: "Types of Moves" },
    { href: "/services/local-moving", label: "Local Moves" },
    { href: "/services/long-distance", label: "Long Distance" },
  ];

  const resourceLinks = [
    { href: "/blog", label: "Blog" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Customer Support" },
  ];

  const footerSections = [
    {
      title: "Quick Links",
      links: [
        { label: "Services", href: "/services" },
        { label: "Types of Moves", href: "/services/types-of-moves" },
        { label: "Local Moving", href: "/services/local-moving" },
        { label: "Long Distance", href: "/services/long-distance" },
      ]
    },
    {
      title: "Resources",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "FAQs", href: "/faq" },
        { label: "Customer Support", href: "/contact" },
      ]
    },
    {
      title: "Connect",
      links: [
        { label: "Become a Provider", href: "/careers" },
        { label: "Refer a Moving Helper", href: "/careers" },
      ]
    },
    {
      title: "Customer Support",
      links: [
        { label: "Contact Us", href: "/contact" },
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-2 rounded-lg transition-transform group-hover:scale-110">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-xl font-headline font-extrabold uppercase tracking-tighter text-primary">
              Wont Stop <span className="text-accent">Moving</span>
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8 text-primary font-bold">
            {navLinks.map((link) => (
              <Link 
                key={link.label} 
                href={link.href} 
                className="text-sm hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm hover:text-accent transition-colors outline-none">
                Resources <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-none shadow-xl">
                {resourceLinks.map((link) => (
                  <DropdownMenuItem key={link.label} asChild>
                    <Link href={link.href} className="w-full cursor-pointer font-bold text-primary hover:text-accent transition-colors py-2">
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-4">
            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-4">
              <Button asChild variant="ghost" className="rounded-full text-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/5">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                <Link href="/book">Book Now</Link>
              </Button>
            </div>

            {/* Mobile Menu Trigger */}
            <div className="lg:hidden">
              {mounted && (
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5 rounded-full">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                    <div className="flex flex-col h-full">
                      <SheetHeader className="p-6 border-b">
                        <SheetTitle className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary text-white p-1.5 rounded-lg">
                              <Truck className="h-5 w-5" />
                            </div>
                            <span className="text-lg font-headline font-black uppercase tracking-tighter text-primary">
                              Wont Stop <span className="text-accent">Moving</span>
                            </span>
                          </div>
                        </SheetTitle>
                      </SheetHeader>
                      
                      <nav className="flex-1 p-6 space-y-6 overflow-y-auto">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Navigation</p>
                          {navLinks.map((link) => (
                            <Link 
                              key={link.label} 
                              href={link.href} 
                              onClick={() => setOpen(false)}
                              className="flex items-center justify-between group py-3 text-xl font-black text-primary hover:text-accent transition-colors border-b border-gray-50 last:border-0"
                            >
                              {link.label}
                              <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </Link>
                          ))}
                          
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="resources" className="border-none">
                              <AccordionTrigger className="text-xl font-black text-primary hover:text-accent hover:no-underline py-3">
                                Resources
                              </AccordionTrigger>
                              <AccordionContent className="pt-2 pb-4 space-y-4">
                                {resourceLinks.map((link) => (
                                  <Link 
                                    key={link.label} 
                                    href={link.href} 
                                    onClick={() => setOpen(false)}
                                    className="block text-lg font-bold text-muted-foreground hover:text-accent pl-4"
                                  >
                                    {link.label}
                                  </Link>
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>

                        <div className="pt-8 space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Account & Services</p>
                          <Button asChild variant="outline" className="w-full rounded-xl h-14 font-bold uppercase tracking-widest text-xs border-primary/20 text-primary">
                            <Link href="/login" onClick={() => setOpen(false)}>Log In to Portal</Link>
                          </Button>
                          <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl h-14 font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20">
                            <Link href="/book" onClick={() => setOpen(false)}>Book Now</Link>
                          </Button>
                        </div>
                      </nav>

                      <div className="p-6 bg-gray-50 mt-auto">
                        <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">
                          Nationwide Coverage 24/7
                        </p>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary pt-20 pb-10 text-white/60 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-6 text-white">
                <Truck className="h-6 w-6 text-accent" />
                <span className="text-xl font-headline font-black uppercase tracking-tighter">
                  Wont Stop <span className="text-accent">Moving</span>
                </span>
              </Link>
              <p className="text-sm leading-relaxed mb-6">
                Redefining the moving experience with technology and transparency. Serving all 50 states and Puerto Rico with unparalleled reliability.
              </p>
            </div>
            
            {/* Desktop View: Columns */}
            {footerSections.map((section, idx) => (
              <div key={idx} className="hidden md:block">
                <h4 className="text-white font-bold mb-6 text-sm">{section.title}</h4>
                <ul className="space-y-4 text-sm">
                  {section.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <Link href={link.href} className="hover:text-accent transition-colors font-bold text-white/90">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Mobile View: Accordion for sections */}
            <div className="md:hidden col-span-1 space-y-4">
              <Accordion type="single" collapsible className="w-full border-t border-white/10">
                {footerSections.map((section, idx) => (
                  <AccordionItem key={idx} value={`item-${idx}`} className="border-white/10">
                    <AccordionTrigger className="text-white font-bold text-sm hover:no-underline hover:text-accent py-4">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-4 pt-2 pb-4">
                        {section.links.map((link, lIdx) => (
                          <li key={lIdx}>
                            <Link href={link.href} className="text-white/70 hover:text-accent transition-colors block text-sm">
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>Copyright © 2026 Wont Stop Moving, Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/accessibility" className="hover:text-white transition-colors">Accessibility</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
