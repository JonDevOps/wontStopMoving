"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Truck, Menu, X, ArrowRight } from 'lucide-react';
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "/services", label: "Services" },
    { href: "/about", label: "About" },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact" },
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
                key={link.href} 
                href={link.href} 
                className="text-sm hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-4">
              <Button asChild variant="ghost" className="rounded-full text-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/5">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                <Link href="/quote">Get a Quote</Link>
              </Button>
            </div>

            {/* Mobile Actions (Quote button only for very small screens if needed, otherwise hidden in menu) */}
            <div className="sm:hidden flex items-center">
               <Button asChild size="sm" className="bg-primary rounded-full px-4 font-bold text-xs h-9">
                <Link href="/quote">Quote</Link>
              </Button>
            </div>

            {/* Mobile Menu Trigger */}
            <div className="lg:hidden">
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
                    
                    <nav className="flex-1 p-6 space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Navigation</p>
                        {navLinks.map((link) => (
                          <Link 
                            key={link.href} 
                            href={link.href} 
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between group py-3 text-xl font-black text-primary hover:text-accent transition-colors border-b border-gray-50 last:border-0"
                          >
                            {link.label}
                            <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                          </Link>
                        ))}
                      </div>

                      <div className="pt-8 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Account & Services</p>
                        <Button asChild variant="outline" className="w-full rounded-xl h-14 font-bold uppercase tracking-widest text-xs border-primary/20 text-primary">
                          <Link href="/login" onClick={() => setOpen(false)}>Log In to Portal</Link>
                        </Button>
                        <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl h-14 font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20">
                          <Link href="/quote" onClick={() => setOpen(false)}>Start Free Quote</Link>
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
            
            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Quick Links</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/services" className="hover:text-accent transition-colors font-bold text-white/90">Services</Link></li>
                <li><Link href="/services" className="hover:text-accent transition-colors font-bold text-white/90">Types of Moves</Link></li>
                <li><Link href="/services" className="hover:text-accent transition-colors font-bold text-white/90">Local Moving</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Resources</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="#" className="hover:text-accent transition-colors font-bold text-white/90">Blog</Link></li>
                <li><Link href="/faq" className="hover:text-accent transition-colors font-bold text-white/90">FAQs</Link></li>
                <li><Link href="/contact" className="hover:text-accent transition-colors font-bold text-white/90">Customer Support</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Connect</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/careers" className="hover:text-accent transition-colors font-bold text-white/90">Become a Provider</Link></li>
                <li><Link href="/careers" className="hover:text-accent transition-colors font-bold text-white/90">Refer a Moving Helper</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm">Customer Support</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/contact" className="hover:text-accent transition-colors font-bold text-white/90">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>© 2024 Wont Stop Moving Inc. Licensed & Insured DOT #1234567</p>
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
