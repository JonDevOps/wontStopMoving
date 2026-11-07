import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { BLOG_POSTS } from '@/app/blog/posts';
import { SITE_URL, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

const findPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return { title: 'Article not found', robots: { index: false } };
  return pageMetadata({ title: post.title, description: post.excerpt, path: `/blog/${post.slug}` });
}

export default async function Layout({ children, params }: Props) {
  const post = findPost((await params).slug);
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
