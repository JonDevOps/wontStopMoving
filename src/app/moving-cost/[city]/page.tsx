import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { MoveCostEstimator } from '@/components/seo/move-cost-estimator';
import { COST_CITIES, SAMPLE_MILES, costCity, sampleCosts } from '@/lib/city-costs';
import { MILEAGE } from '@/lib/pricing';
import { cityReport } from '@/lib/server/city-reports';
import { pageMetadata } from '@/lib/seo';

// Rendered on first visit and refreshed daily (local mover data comes from the registry).
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Params = { params: Promise<{ city: string }> };
const YEAR = new Date().getFullYear();
const usd = (n: number) => `$${n.toLocaleString()}`;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = costCity((await params).city);
  if (!c) return { title: 'Moving costs', robots: { index: false } };
  const [studio] = sampleCosts();
  return pageMetadata({
    title: `How Much Do Movers Cost in ${c.city}, ${c.state}? (${YEAR} Prices)`,
    description: `Flat moving prices in ${c.city} start at ${usd(studio.prices[0])} for a studio across town. Use the free estimator to price your move by home size, distance and extras.`,
    path: `/moving-cost/${c.slug}`,
  });
}

export default async function MovingCostCity({ params }: Params) {
  const c = costCity((await params).city);
  if (!c) notFound();
  const rows = sampleCosts();
  const local = await cityReport(c.state, c.citySlug).catch(() => null);
  const two = rows[1].prices[0];
  const neighbors = COST_CITIES.filter(o => o.slug !== c.slug && (o.state === c.state || Math.abs(o.rank - c.rank) <= 3)).slice(0, 10);

  const faq = [
    { q: `How much do movers cost in ${c.city}?`, a: `With Wont Stop Moving, a local move in ${c.city} is a flat price: about ${usd(rows[0].prices[0])} for a studio or 1-bedroom and ${usd(two)} for a 2-bedroom when the homes are within ${MILEAGE.includedMiles} miles. Larger homes, longer distances and extras like packing add to the price, and the estimator above shows you exactly how much.` },
    ...(local?.prices?.twoMovers ? [{ q: `What do hourly movers charge around ${c.city}?`, a: `Movers in the ${local.stateName} market we track publish a median of $${local.prices.twoMovers} an hour for two movers and a truck${local.prices.minimumHours ? `, usually with a ${local.prices.minimumHours}-hour minimum` : ''}. Hourly bills grow with stairs, long carries and slow crews, which is why we quote a flat price.` }] : []),
    { q: `Does the price change with distance?`, a: `The first ${MILEAGE.includedMiles} miles between your homes are included. After that it's $${MILEAGE.perMile} a mile. Moves over ${MILEAGE.longDistanceMiles} miles get a custom long-distance quote.` },
    { q: 'Are there discounts?', a: 'Students and military members get 5% off. Referral credits apply too.' },
    { q: `How do I know a ${c.city} mover is legitimate?`, a: 'Ask for their USDOT number and look it up in our free Check a Mover tool. It shows their federal license, insurance on file and years in business. Every mover we send is checked daily.' },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };

  return (
    <PublicLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="bg-primary pt-32 sm:pt-36 pb-10 text-white">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <Link href="/moving-cost" className="text-sm font-bold text-white/70 hover:text-white">← Moving costs by city</Link>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter">How much do movers cost in <span className="text-accent">{c.city}, {c.state}?</span></h1>
          <p className="text-lg text-white/80">A local {c.city} move with Wont Stop Moving is a flat price that starts at {usd(rows[0].prices[0])}. Set your home size, distance and extras below to see your price.</p>
        </div>
      </section>
      <div className="bg-gray-50 pb-24">
        <div className="max-w-4xl mx-auto px-4 space-y-8 -mt-2 pt-6">
          <MoveCostEstimator city={c.city} campaign={c.slug} />

          <section className="bg-white rounded-2xl p-6 space-y-3">
            <h2 className="text-2xl font-black text-primary">Typical {c.city} moving prices</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-2 pr-3">Home size</th>{SAMPLE_MILES.map(m => <th key={m} className="py-2 pr-3">{m} miles</th>)}</tr></thead>
                <tbody>{rows.map(r => <tr key={r.size} className="border-t"><td className="py-2 pr-3 font-semibold">{r.label}</td>{r.prices.map((p, i) => <td key={i} className="py-2 pr-3">{usd(p)}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Flat prices before extras and discounts. 10 miles is a move across town, 40 across the {c.city} area, 120 to a nearby city. Your exact price is confirmed in your quote.</p>
          </section>

          {local && <section className="bg-white rounded-2xl p-6 space-y-2 text-slate-700">
            <h2 className="text-2xl font-black text-primary">The {c.city} moving market</h2>
            <p>{local.movers.toLocaleString()} moving companies registered with the U.S. Department of Transportation are based in {local.city}, running {local.trucks.toLocaleString()} trucks between them. The typical one has been in business {local.medianYears} years, and {local.authorityPct}% are licensed to move you to another state.</p>
            {local.prices?.twoMovers && <p>Local movers who publish hourly rates charge a median of <b>${local.prices.twoMovers}/hour</b> for two movers and a truck{local.prices.threeMovers ? ` and $${local.prices.threeMovers}/hour for three` : ''}{local.prices.minimumHours ? `, with a ${local.prices.minimumHours}-hour minimum` : ''}.</p>}
            <p><Link className="underline font-bold" href={`/moving-reports/${local.state.toLowerCase()}/${local.slug}`}>Read the full {local.city} moving market report →</Link></p>
          </section>}

          <section className="bg-white rounded-2xl p-6 space-y-3">
            <h2 className="text-2xl font-black text-primary">What changes the price</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li><b>Home size</b> sets the base price (crew size and truck time).</li>
              <li><b>Distance</b>: the first {MILEAGE.includedMiles} miles are included, then ${MILEAGE.perMile} a mile.</li>
              <li><b>Extras</b> like packing, cleaning, junk removal, storage or a piano.</li>
              <li><b>Express dates</b> add 25% of the base price.</li>
              <li><b>Discounts</b>: 5% off for students and military.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black text-primary">Questions</h2>
            {faq.map(f => <details key={f.q} className="bg-white rounded-xl p-4"><summary className="font-semibold cursor-pointer">{f.q}</summary><p className="mt-2 text-slate-700">{f.a}</p></details>)}
          </section>

          {neighbors.length > 0 && <section className="space-y-2">
            <h2 className="text-xl font-black text-primary">Moving costs in other cities</h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{neighbors.map(o => <Link key={o.slug} className="underline" href={`/moving-cost/${o.slug}`}>{o.city}, {o.state}</Link>)}</p>
          </section>}
        </div>
      </div>
    </PublicLayout>
  );
}
