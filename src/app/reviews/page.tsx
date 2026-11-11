import type { Metadata } from 'next';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { adminDb } from '@/lib/server/firebase-admin';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({ title: 'Customer Reviews', description: 'What customers say about moving with Wont Stop Moving: verified reviews from completed moves.', path: '/reviews' });

// New reviews appear within the hour.
export const revalidate = 3600;

type Review = { id: string; name: string; rating: number; comment: string; date: string };

/** Reviews come only from customers whose move was completed (one per job). */
async function loadReviews(): Promise<{ reviews: Review[]; count: number; average: number | null }> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return { reviews: [], count: 0, average: null };
  try {
    const snap = await adminDb().collectionGroup('reviews').orderBy('createdAt', 'desc').limit(200).get();
    const all = snap.docs.map(d => d.data()).filter(r => Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
    const average = all.length ? Math.round((all.reduce((n, r) => n + r.rating, 0) / all.length) * 10) / 10 : null;
    const reviews = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Record<string, any>))
      .filter(r => r.rating >= 4 && typeof r.comment === 'string' && r.comment.trim().length >= 10)
      .slice(0, 30)
      .map(r => ({ id: r.id, name: String(r.customerName || 'Customer').slice(0, 40), rating: r.rating, comment: r.comment.trim().slice(0, 600), date: r.createdAt?.toDate?.().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) || '' }));
    return { reviews, count: all.length, average };
  } catch (error) {
    console.error('Could not load reviews', error);
    return { reviews: [], count: 0, average: null };
  }
}

const Stars = ({ n }: { n: number }) => <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map(i => <Star key={i} className={`h-4 w-4 ${i <= n ? 'fill-accent text-accent' : 'text-gray-300'}`} />)}</span>;

export default async function ReviewsPage() {
  const { reviews, count, average } = await loadReviews();
  return <PublicLayout>
    <section className="bg-primary pt-40 pb-20 text-white">
      <div className="container mx-auto px-4 text-center space-y-4">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">Customer <span className="text-accent">Reviews</span></h1>
        <p className="text-xl opacity-80 max-w-2xl mx-auto">Reviews from customers whose moves were completed through Wont Stop Moving.</p>
        {average !== null && <p className="text-lg font-bold">{average.toFixed(1)} out of 5 · {count} review{count === 1 ? '' : 's'}</p>}
      </div>
    </section>
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-5xl">
        {reviews.length === 0 ? (
          <div className="text-center space-y-4 py-12">
            <p className="text-lg text-muted-foreground">Reviews from completed moves will appear here.</p>
            <Link href="/quote" className="inline-flex rounded-full bg-accent text-white px-8 h-12 items-center font-black uppercase tracking-widest text-xs">Get an instant quote</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {reviews.map(r => <figure key={r.id} className="rounded-3xl border border-gray-100 p-6 space-y-3 bg-gray-50/50">
              <Stars n={r.rating} />
              <blockquote className="text-slate-700 leading-relaxed">“{r.comment}”</blockquote>
              <figcaption className="text-sm font-bold text-primary">{r.name}{r.date ? <span className="font-medium text-muted-foreground"> · {r.date}</span> : null}</figcaption>
            </figure>)}
          </div>
        )}
      </div>
    </section>
  </PublicLayout>;
}
