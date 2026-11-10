import type { Metadata } from 'next';

/** Site-wide SEO facts. Only true, verifiable details belong here. */
export const SITE_URL = 'https://wontstopmoving.com';
export const SITE_NAME = 'Wont Stop Moving';
export const SOCIAL_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Wont Stop Moving — Moving made simple' };
export const SITE_PHONE = '+1-650-569-0584';
export const SITE_EMAIL = 'support@wontstopmoving.com';
export const DEFAULT_DESCRIPTION =
  'Wont Stop Moving connects you with vetted, independent movers across the U.S., Puerto Rico and Canada. Get an instant quote, book online with upfront pricing, and your mover is paid only after the job is done.';

/** Title, description, canonical URL and social previews for one page. */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  return {
    // Absolute so nested section layouts can't drop the brand suffix.
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', url, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [SOCIAL_IMAGE] },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: [SOCIAL_IMAGE] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export type ServiceInfo = { name: string; description: string };

/** One entry per /services/<slug> page. */
export const SERVICES: Record<string, ServiceInfo> = {
  'local-moving': { name: 'Local Moving', description: 'Stress-free moves within your city or state with vetted local movers, upfront pricing, and movers paid only after the job is done.' },
  'long-distance': { name: 'Long-Distance Moving', description: 'State-to-state and cross-country moves planned end to end, with upfront pricing, and movers paid only after delivery.' },
  'express-moving': { name: 'Express Moving', description: 'Priority scheduling and dedicated transport for urgent, short-notice moves.' },
  'commercial': { name: 'Commercial Moving', description: 'Office and business relocations planned to minimize downtime, from startups to large offices.' },
  'workplace-solutions': { name: 'Workplace Solutions', description: 'Office moves, furniture reconfiguration and decommissioning, managed from planning to setup.' },
  'data-center': { name: 'Data Center Moving', description: 'Careful relocation of servers and IT equipment with anti-static handling and secure transport.' },
  'hospitality': { name: 'Hospitality FF&E Logistics', description: 'Furniture, fixtures and equipment logistics for hotels, resorts and restaurants.' },
  'warehousing-logistics': { name: 'Warehousing & Logistics', description: 'Storage and delivery coordinated through vetted partners for businesses that need backend logistics.' },
  'vaulted-storage': { name: 'Vaulted Storage', description: 'Climate-controlled storage in individual wooden vaults through vetted storage partners, for as long as you need.' },
  'white-glove-packing': { name: 'White-Glove Packing', description: 'Full-service packing, from wrapping fragile china to unpacking and organizing in your new home.' },
  'specialty-crating': { name: 'Specialty Crating', description: 'Custom wooden crates for fine art, antiques and large electronics.' },
  'piano-moving': { name: 'Piano Moving', description: 'Upright and grand piano moving with specialized padding, equipment and trained movers.' },
  'gun-safe-moving': { name: 'Gun Safe Moving', description: 'Heavy safe and vault relocation with industrial equipment and trained heavy-haul movers.' },
  'military-relocation': { name: 'Military PCS Moves', description: 'Support for military PCS moves, coordinated around your orders.' },
  'student-moves': { name: 'Student Moves', description: 'Affordable small-load moves for students and campus life.' },
  'junk-removal': { name: 'Junk Removal', description: 'Haul away unwanted items before or after a move, with donation and recycling where possible.' },
  'cleaning-services': { name: 'Move-In & Move-Out Cleaning', description: 'Deep move-in and move-out cleaning so you can hand over or settle into a clean home.' },
  'handyman-assembly': { name: 'Handyman & Furniture Assembly', description: 'Furniture assembly, TV mounting and picture hanging so your new place is ready on day one.' },
  'protection-plans': { name: 'Moving Protection Plans', description: 'Protection options for your belongings during the move, explained clearly before you book.' },
  'types-of-moves': { name: 'Types of Moves', description: 'From apartments and houses to offices and specialty items: the kinds of moves we handle.' },
};

/** Title-cases a URL slug: "new-york" -> "New York". */
export function titleFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MovingCompany',
      '@id': `${SITE_URL}/#company`,
      name: SITE_NAME,
      url: SITE_URL,
      telephone: SITE_PHONE,
      email: SITE_EMAIL,
      description: DEFAULT_DESCRIPTION,
      areaServed: [
        { '@type': 'Country', name: 'United States' },
        { '@type': 'Place', name: 'Puerto Rico' },
        { '@type': 'Country', name: 'Canada' },
      ],
      paymentAccepted: 'Credit card',
      priceRange: '$$',
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL, name: SITE_NAME, publisher: { '@id': `${SITE_URL}/#company` } },
  ],
};

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function serviceJsonLd(slug: string, area?: string) {
  const s = SERVICES[slug];
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s ? s.name : 'Moving services',
    description: s?.description || DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/services/${slug}`,
    provider: { '@id': `${SITE_URL}/#company` },
    areaServed: area || 'United States, Puerto Rico and Canada',
  };
}
