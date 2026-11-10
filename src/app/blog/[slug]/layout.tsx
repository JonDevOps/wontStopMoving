import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { findPublicPost } from '@/lib/server/blog';
import { SITE_URL, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';

// Rendered per request so a scheduled post appears at its publish time and an
// unscheduled one disappears immediately (never a cached "not found").
export const dynamic = 'force-dynamic';

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

const findPost = (slug: string) => findPublicPost(slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await findPost((await params).slug);
  if (!post) return { title: 'Article not found', robots: { index: false } };
  return pageMetadata({ title: post.title, description: post.excerpt, path: `/blog/${post.slug}` });
}

export default async function Layout({ children, params }: Props) {
  const post = await findPost((await params).slug);
  if (!post) notFound();
  const published = new Date(post.date);
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          articleSection: post.category,
          ...(isNaN(published.getTime()) ? {} : { datePublished: published.toISOString().slice(0, 10) }),
          url: `${SITE_URL}/blog/${post.slug}`,
          author: { '@type': 'Organization', name: 'Wont Stop Moving' },
          publisher: { '@id': `${SITE_URL}/#company` },
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      {children}
    </>
  );
}
