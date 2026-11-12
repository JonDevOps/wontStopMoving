'use client';

import { Phone } from 'lucide-react';
import { SupportDialog } from '@/components/support/support-dialog';
import { useUser } from '@/firebase';
import { SITE_PHONE } from '@/lib/seo';

/** Always-visible "Call" and "Get help" buttons on public pages (big call button on phones). */
export function QuickContact() {
  const { user } = useUser();
  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 print:hidden">
      <a
        href={`tel:${SITE_PHONE}`}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 h-12 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-accent/30 hover:bg-accent/90 sm:hidden"
        aria-label="Call Wont Stop Moving"
      >
        <Phone className="h-4 w-4" /> Call
      </a>
      <div className="rounded-full bg-white shadow-xl">
        <SupportDialog email={user?.email} name={user?.displayName || undefined} />
      </div>
    </div>
  );
}
