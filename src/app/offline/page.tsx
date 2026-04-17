import { PublicLayout } from '@/components/layout/public-layout';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-[70vh] items-center justify-center bg-gray-50 pt-20 text-center px-4">
        <h1 className="text-4xl md:text-5xl font-headline font-black text-primary mb-4">You Are Offline</h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">Our movers need an internet connection to sync your latest request! Please check your connection and try again.</p>
        <Button asChild size="lg" className="bg-accent text-white rounded-full px-8 text-lg font-bold shadow-xl">
          <Link href="/">Try Again</Link>
        </Button>
      </div>
    </PublicLayout>
  );
}
