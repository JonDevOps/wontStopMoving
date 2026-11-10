import type { MetadataRoute } from 'next';
import { allPublicPosts } from '@/lib/server/blog';
import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';
import { SERVICES, SITE_URL } from '@/lib/seo';

/**
 * Public pages, including every state and city service-area page.
 * Agent guides remain public and discoverable here too.
 */
// Rebuilt hourly so newly published blog posts are listed.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'monthly') => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  const core = [
    entry('', 1, 'weekly'),
    entry('/quote', 0.9),
    entry('/book', 0.9),
    entry('/services', 0.8),
    entry('/locations', 0.8),
    entry('/marketplace', 0.7, 'weekly'),
    entry('/faq', 0.7),
    entry('/about', 0.6),
    entry('/contact', 0.6),
    entry('/blog', 0.6, 'weekly'),
    entry('/careers', 0.5),
    entry('/provider-signup', 0.5),
    entry('/privacy', 0.2, 'yearly'),
    entry('/terms', 0.2, 'yearly'),
    entry('/accessibility', 0.2, 'yearly'),
    entry('/moving-checklist.pdf', 0.4, 'yearly'),
    entry('/reviews', 0.6, 'weekly'),
    ...['/llms.txt', '/llms-full.txt', '/pricing.md', '/how-booking-works.md', '/faq.md', '/service-area.md', '/AGENTS.md'].map((p) => entry(p, 0.4)),
  ];

  const services = Object.keys(SERVICES).map((slug) => entry(`/services/${slug}`, 0.8));

  const blog = (await allPublicPosts()).map((post) => {
    const date = new Date(post.date);
    return {
      ...entry(`/blog/${post.slug}`, 0.5, 'yearly'),
      lastModified: isNaN(date.getTime()) ? now : date,
    };
  });

  const places = ALL_LOCATIONS.flatMap((state) => {
    const stateSlug = slugify(state);
    const cities = CITIES_BY_STATE[stateSlug] || [];
    return [
      entry(`/locations/${stateSlug}`, 0.7),
      ...cities.map((city) => entry(`/locations/${stateSlug}/${slugify(city)}`, 0.5)),
    ];
  });

  return [...core, ...services, ...blog, ...places];
}
