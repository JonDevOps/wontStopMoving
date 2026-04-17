import { PublicLayout } from '@/components/layout/public-layout';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white pt-20 text-center px-4">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl max-w-lg border border-blue-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m-2.828 9.9a9 9 0 010-12.728M5.636 5.636L21 21" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-black text-blue-900 mb-4 tracking-tight">You Are Offline</h1>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed font-medium">
            Our movers can&apos;t reach you right now! Please check your internet connection to continue with your move.
          </p>
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-12 h-14 text-lg font-bold shadow-xl transition-all hover:scale-105 active:scale-95">
            <Link href="/">Try Again</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

