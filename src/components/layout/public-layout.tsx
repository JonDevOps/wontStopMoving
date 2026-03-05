"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Truck, ArrowRight } from 'lucide-react';
import React from 'react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
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
          
          <nav className="hidden lg:flex items-center gap-8 text-primary font-bold">
            <Link href="/services" className="text-sm hover:text-accent transition-colors">Services</Link>
            <Link href="/about" className="text-sm hover:text-accent transition-colors">About</Link>
            <Link href="/careers" className="text-sm hover:text-accent transition-colors">Careers</Link>
            <Link href="/contact" className="text-sm hover:text-accent transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" className="hidden sm:flex rounded-full text-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/5">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Link href="/quote">Get a Quote</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary pt-20 pb-10 text-white/60 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-1">
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
              <h4 className="text-white font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/about" className="hover:text-accent transition-colors">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-accent transition-colors">Careers</Link></li>
                <li><Link href="/services" className="hover:text-accent transition-colors">Our Services</Link></li>
                <li><Link href="/press" className="hover:text-accent transition-colors">Press & Media</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Support</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/contact" className="hover:text-accent transition-colors">Contact Us</Link></li>
                <li><Link href="/faq" className="hover:text-accent transition-colors">FAQ</Link></li>
                <li><Link href="/track" className="hover:text-accent transition-colors">Track Move</Link></li>
                <li><Link href="/insurance" className="hover:text-accent transition-colors">Insurance Info</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6">Regional Offices</h4>
              <p className="text-sm leading-relaxed mb-4">
                Headquarters: 123 Momentum Way, Dallas, TX 75201
              </p>
              <p className="text-sm font-bold text-white mb-2">1-800-MOVE-NOW</p>
              <p className="text-sm">support@wontstopmoving.com</p>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>© 2024 Wont Stop Moving Inc. Licensed & Insured DOT #1234567.</p>
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