import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { cityIndex } from '@/lib/server/city-reports';

export const dynamic = 'force-dynamic'; // Built from live registry data (cached in memory), not at deploy time.
export const metadata: Metadata = {
  title: 'Moving Company Market Reports by City',
  description: 'How many licensed moving companies serve your city, how established they are, and what moves cost. Free reports from federal FMCSA records, updated daily.',
  alternates: { canonical: '/moving-reports' },
};

export default async function MovingReportsIndex() {
  const cities = await cityIndex().catch(() => []);
  const byState = new Map<string, typeof cities>();
  for (const c of cities) byState.set(c.stateName, [...(byState.get(c.stateName) || []), c]);
  const states = [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Moving <span className="text-accent">market reports</span></h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">How many licensed moving companies serve each city, how established they are, and what moves cost there, from federal FMCSA records updated daily.</p>
        </header>
        {!states.length ? <p className="text-center text-muted-foreground">Reports are being prepared. Check back soon.</p> :
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {states.map(([name, list]) => <section key={name} className="bg-white rounded-2xl p-5 space-y-2">
              <h2 className="font-black text-primary">{name}</h2>
              <ul className="text-sm space-y-1">{list.slice(0, 15).map(c => <li key={c.slug}><Link className="underline hover:text-accent" href={`/moving-reports/${c.state.toLowerCase()}/${c.slug}`}>{c.city}</Link> <span className="text-muted-foreground">· {c.movers} movers</span></li>)}</ul>
              {list.length > 15 && <p className="text-xs text-muted-foreground">+ {list.length - 15} more cities</p>}
            </section>)}
          </div>}
      </div>
    </div>
  </PublicLayout>;
}
