import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { cityReport } from '@/lib/server/city-reports';

export const dynamic = 'force-dynamic'; // Live registry data (cached in memory); avoids caching a 'not found' while data loads.
type Params = { params: Promise<{ state: string; city: string }> };
const YEAR = new Date().getFullYear();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { state, city } = await params;
  const r = await cityReport(state.toUpperCase(), city).catch(() => null);
  if (!r) return { title: 'Moving market report', robots: { index: false } };
  return {
    title: `Moving Companies in ${r.city}, ${r.state}: ${YEAR} Market Report`,
    description: `${r.movers} licensed moving companies are based in ${r.city}, ${r.stateName}. See how established they are, how many can move you across state lines, and what local moves cost.`,
    alternates: { canonical: `/moving-reports/${r.state.toLowerCase()}/${r.slug}` },
  };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="bg-white rounded-2xl p-5"><p className="text-3xl font-black text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="text-sm text-muted-foreground">{label}</p></div>;
}
function Bars({ title, bands }: { title: string; bands: { label: string; count: number }[] }) {
  const max = Math.max(1, ...bands.map(b => b.count));
  return <div className="bg-white rounded-2xl p-5 space-y-3"><h3 className="font-black text-primary">{title}</h3>
    {bands.map(b => <div key={b.label} className="text-sm"><div className="flex justify-between"><span>{b.label}</span><span className="font-semibold">{b.count}</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(b.count / max) * 100}%` }} /></div></div>)}
  </div>;
}

export default async function CityMovingReport({ params }: Params) {
  const { state, city } = await params;
  const r = await cityReport(state.toUpperCase(), city).catch(() => null);
  if (!r) notFound();
  const faq = [
    { q: `How many moving companies are there in ${r.city}?`, a: `${r.movers} moving companies registered with the U.S. Department of Transportation list ${r.city}, ${r.state} as their base, with ${r.trucks.toLocaleString()} trucks between them.` },
    { q: `How do I know if a ${r.city} mover is licensed?`, a: `Ask for their USDOT number and look it up in our free Check a Mover tool, which shows their federal license, insurance on file and years in business.${r.state === 'CA' ? ' California movers also need a CPUC household goods permit (a CAL-T number).' : r.state === 'WA' ? ' Washington movers also need a UTC household goods permit.' : ''}` },
    ...(r.prices?.twoMovers ? [{ q: `How much do movers cost in ${r.city}?`, a: `Movers in the ${r.stateName} market we track charge a median of $${r.prices.twoMovers} an hour for two movers and a truck${r.prices.threeMovers ? ` and $${r.prices.threeMovers} for three` : ''}${r.prices.minimumHours ? `, usually with a ${r.prices.minimumHours}-hour minimum` : ''}.` }] : []),
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return <PublicLayout>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <article className="max-w-4xl mx-auto px-4 space-y-8">
        <header className="space-y-3">
          <Link href="/moving-reports" className="text-sm font-bold text-primary">← All market reports</Link>
          <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Moving companies in {r.city}, {r.state}: <span className="text-accent">{YEAR} market report</span></h1>
          <p className="text-lg text-muted-foreground">What the federal records say about the moving companies based in {r.city}, {r.stateName}{r.updated ? `, updated ${new Date(r.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.</p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat value={r.movers} label="licensed moving companies" />
          <Stat value={r.trucks} label="trucks between them" />
          <Stat value={`${r.medianYears} yrs`} label="typical time in business" />
          <Stat value={`${r.authorityPct}%`} label="licensed to move you to another state" />
        </section>

        <section className="bg-white rounded-2xl p-6 space-y-3 text-slate-700 leading-relaxed">
          <h2 className="text-2xl font-black text-primary">The {r.city} moving market at a glance</h2>
          <p>{r.city} is home to {r.movers} moving companies registered with the U.S. Department of Transportation, out of {r.statewide.movers.toLocaleString()} across {r.stateName}. Most are small: the typical company runs {r.medianFleet} truck{r.medianFleet === 1 ? '' : 's'}{r.medianFleet !== r.statewide.medianFleet ? ` (statewide it's ${r.statewide.medianFleet})` : ''}, and {r.established10} of them have been in business 10 years or more.</p>
          <p>{r.authorityPct}% hold federal authority to move household goods across state lines; the rest are licensed for moves within {r.stateName} only. That matters if you’re leaving the state: an in-state-only company can’t legally take you across the border.</p>
          <p>{r.newThisYear ? `${r.newThisYear} new moving compan${r.newThisYear === 1 ? 'y' : 'ies'} registered in the last 12 months` : 'No new moving companies registered here in the last 12 months'}{r.closedThisYear ? `, and ${r.closedThisYear} closed or lost their authority` : ''}. New companies can be great, but check their license and insurance before you book.</p>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          <Bars title="Fleet size" bands={r.sizeBands} />
          <Bars title="Years in business" bands={r.yearsBands} />
        </div>

        {r.prices && <section className="bg-white rounded-2xl p-6 space-y-2">
          <h2 className="text-2xl font-black text-primary">What moving costs around {r.city}</h2>
          <p className="text-slate-700">From prices published on {r.prices.sample} local movers’ websites in {r.stateName}:</p>
          <ul className="list-disc pl-5 text-slate-700">
            {r.prices.twoMovers && <li>Two movers and a truck: about <b>${r.prices.twoMovers}/hour</b></li>}
            {r.prices.threeMovers && <li>Three movers and a truck: about <b>${r.prices.threeMovers}/hour</b></li>}
            {r.prices.minimumHours && <li>Typical minimum: <b>{r.prices.minimumHours} hours</b>, plus travel time</li>}
          </ul>
          <p className="text-sm text-muted-foreground">Hourly prices can climb with stairs, long carries and slow crews. A flat price protects you from surprises.</p>
        </section>}

        <section className="bg-white rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-black text-primary">How to choose a mover in {r.city}</h2>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700">
            <li><b>Check the license.</b> Look up the company’s USDOT number in our <Link className="underline" href="/check-a-mover">Check a Mover</Link> tool.{r.state === 'CA' ? ' In California, also ask for their CPUC permit (CAL-T number).' : ''}</li>
            <li><b>Confirm insurance</b> for your belongings, not just the truck.</li>
            <li><b>Get a written estimate</b> based on seeing your things (in person or by video), and be wary of quotes far below everyone else’s.</li>
            <li><b>Avoid big cash deposits</b>, and pay by card when you can.</li>
            <li><b>Read recent reviews</b>, especially how the company handled problems.</li>
          </ol>
        </section>

        <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-3 text-center">
          <p className="text-2xl font-black">Moving in or around {r.city}?</p>
          <p className="text-slate-300">Wont Stop Moving sends licensed, insured movers we keep checking every day, with clear flat prices.</p>
          <Button asChild size="lg" className="font-black uppercase"><Link href={`/quote?utm_source=moving-report&utm_medium=seo&utm_campaign=${r.state.toLowerCase()}-${r.slug}`}>Get a free quote</Link></Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-primary">Questions</h2>
          {faq.map(f => <details key={f.q} className="bg-white rounded-xl p-4"><summary className="font-semibold cursor-pointer">{f.q}</summary><p className="mt-2 text-slate-700">{f.a}</p></details>)}
        </section>

        {r.nearby.length > 0 && <section className="space-y-2">
          <h2 className="text-xl font-black text-primary">Other {r.stateName} reports</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{r.nearby.map(c => <Link key={c.slug} className="underline" href={`/moving-reports/${c.state.toLowerCase()}/${c.slug}`}>{c.city}</Link>)}</p>
        </section>}

        <p className="text-xs text-muted-foreground">About this data: counts include active carriers registered with FMCSA to carry household goods that are based in {r.city} and appear to be moving companies (for-hire, with moving authority or a moving business name). Companies licensed only by the state, or based elsewhere but serving {r.city}, may not be included. Source: U.S. Department of Transportation FMCSA Company Census and licensing data.</p>
      </article>
    </div>
  </PublicLayout>;
}
