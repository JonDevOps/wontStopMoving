import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { CITIES_BY_STATE } from '@/lib/location-data';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { stateNameFor } from '@/lib/seo-locations';

type Params = Promise<{ stateSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const name = stateNameFor((await params).stateSlug);
  if (!name) return { title: 'Location not found', robots: { index: false } };
  const count = CITIES_BY_STATE[(await params).stateSlug].length;
  return pageMetadata({
    title: `Movers in ${name}`,
    description: `Local and long-distance movers serving ${count.toLocaleString()} cities in ${name}. Get an instant quote and book with upfront pricing. Movers are paid only after the job is done.`,
    path: `/locations/${(await params).stateSlug}`,
  });
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { stateSlug } = await params;
  const name = stateNameFor(stateSlug);
  if (!name) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Service Areas', path: '/locations' },
          { name, path: `/locations/${stateSlug}` },
        ])}
      />
      {children}
    </>
  );
}
