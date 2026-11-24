import Link from 'next/link';
import type { Metadata } from 'next';
import { Home, Search, Phone } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { BUSINESS_CONTACT } from '@/lib/business-contact';

export const metadata: Metadata = {
  title: 'Page not found | Wont Stop Moving',
  robots: { index: false, follow: true },
};

// Site-wide 404 (#106): keeps the public nav and offers a way back home.
export default function NotFound() {
  return (
    <PublicLayout>
      <section className="min-h-[70vh] flex items-center bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Error 404</p>
          <h1 className="text-4xl md:text-6xl font-headline font-black text-primary uppercase tracking-tighter mb-6">
            This page moved out
          </h1>
          <p className="text-lg text-muted-foreground mb-10">
            We couldn&apos;t find the page you were looking for. It may have been renamed or no longer exists.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="rounded-full px-8 h-12 font-bold">
              <Link href="/"><Home className="h-4 w-4 mr-2" /> Back to homepage</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-8 h-12 font-bold">
              <Link href="/movers"><Search className="h-4 w-4 mr-2" /> Find movers</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full px-8 h-12 font-bold">
              <a href={BUSINESS_CONTACT.phoneHref}><Phone className="h-4 w-4 mr-2" /> {BUSINESS_CONTACT.phoneDisplay}</a>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
