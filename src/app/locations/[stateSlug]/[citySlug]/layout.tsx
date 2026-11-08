import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE_URL, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { cityFor } from '@/lib/seo-locations';

type Params = Promise<{ stateSlug: string; citySlug: string }>;

const lookup = cityFor;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stateSlug, citySlug } = await params;
  const place = lookup(stateSlug, citySlug);
  if (!place) return { title: 'Location not found', robots: { index: false } };
  return pageMetadata({
    title: `Movers in ${place.city}, ${place.state}`,
    description: `Local and long-distance movers in ${place.city}, ${place.state}. Packing, specialty items and storage, with an instant quote, upfront pricing and payment held in escrow until the job is done.`,
    path: `/locations/${stateSlug}/${citySlug}`,
  });
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { stateSlug, citySlug } = await params;
  const place = lookup(stateSlug, citySlug);
  if (!place) notFound();
  const path = `/locations/${stateSlug}/${citySlug}`;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Service Areas', path: '/locations' },
          { name: place.state, path: `/locations/${stateSlug}` },
          { name: place.city, path },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: `Moving services in ${place.city}, ${place.state}`,
          serviceType: 'Moving',
          url: `${SITE_URL}${path}`,
          provider: { '@id': `${SITE_URL}/#company` },
          areaServed: { '@type': 'City', name: place.city, containedInPlace: { '@type': 'State', name: place.state } },
        }}
      />
      {children}
    </>
  );
}
