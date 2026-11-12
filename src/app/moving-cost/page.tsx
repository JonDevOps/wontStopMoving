import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { COST_CITIES, sampleCosts } from '@/lib/city-costs';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Moving Costs by City',
  description: 'Flat moving prices and a free estimator for the 100 largest U.S. cities: what a studio, 2-bedroom or family home costs to move across town or across the metro.',
  path: '/moving-cost',
});

export default function MovingCostIndex() {
  const [studio, twoBed] = sampleCosts();
  return (
    <PublicLayout>
      <section className="bg-primary pt-32 sm:pt-36 pb-12 text-white">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter">Moving costs <span className="text-accent">by city</span></h1>
          <p className="text-lg text-white/80">Local moves start at ${studio.prices[0].toLocaleString()} for a studio and ${twoBed.prices[0].toLocaleString()} for a 2-bedroom. Pick your city to estimate your move.</p>
        </div>
      </section>
      <div className="bg-gray-50 py-12">
        <ol className="max-w-4xl mx-auto px-4 grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {COST_CITIES.map(c => (
            <li key={c.slug}><Link className="font-semibold text-primary hover:text-accent underline-offset-2 hover:underline" href={`/moving-cost/${c.slug}`}>{c.city}, {c.state}</Link></li>
          ))}
        </ol>
      </div>
    </PublicLayout>
  );
}
