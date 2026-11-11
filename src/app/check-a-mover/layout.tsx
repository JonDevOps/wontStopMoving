import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check a Mover: Is Your Moving Company Licensed and Insured?',
  description: 'Free tool: look up any U.S. moving company by name, USDOT or MC number and see its federal license, insurance on file, years in business and red flags, straight from FMCSA records.',
  alternates: { canonical: '/check-a-mover' },
};

export default function CheckAMoverLayout({ children }: { children: React.ReactNode }) { return children; }
