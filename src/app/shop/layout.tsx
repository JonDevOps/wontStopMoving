import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Moving Supplies: Boxes, Kits and Packing Materials',
  description: 'Moving boxes, packing kits, bubble wrap, tape and mattress bags. Delivered with your move, delivered to your door in the Bay Area, or picked up in Mountain View.',
  alternates: { canonical: '/shop' },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) { return children; }
