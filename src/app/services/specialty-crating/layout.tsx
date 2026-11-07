import { JsonLd } from '@/components/seo/json-ld';
import { SERVICES, breadcrumbJsonLd, pageMetadata, serviceJsonLd } from '@/lib/seo';

const SLUG = "specialty-crating";
const service = SERVICES[SLUG];

export const metadata = pageMetadata({
  title: service.name,
  description: service.description,
  path: `/services/${SLUG}`,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={serviceJsonLd(SLUG)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Services', path: '/services' },
          { name: service.name, path: `/services/${SLUG}` },
        ])}
      />
      {children}
    </>
  );
}
