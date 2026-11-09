import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Review your custom quote | Wont Stop Moving', robots: { index: false, follow: false } };

export default function CustomQuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
