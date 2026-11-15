import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { moverCity } from '@/lib/server/mover-locations';
import { adminDb } from '@/lib/server/firebase-admin';
import { isId } from '@/lib/server/auth';
import { validProviderPricing } from '@/lib/mover-pricing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moving provider | Wont Stop Moving', robots: { index: false, follow: true } };
export default async function MoverProfile({ params, searchParams }: { params: Promise<{ region: string; city: string; providerId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { region, city, providerId } = await params;
  const place = moverCity(region,city);
  if (!place || !isId(providerId)) notFound();
  const p = (await adminDb().doc(`providers/${providerId}`).get()).data();
  if (!p || p.status !== 'approved') notFound();
  const reviews = await adminDb().collection(`providers/${providerId}/reviews`).orderBy('createdAt', 'desc').limit(10).get();
  const search = await searchParams;
  const hours = Math.max(Number(p.minimumHours) || 2, Math.min(24, Math.floor(Number(search.hours) || 2)));
  const bookable = validProviderPricing(p.hourlyRate,p.minimumHours) && p.stripeOnboardingComplete === true && typeof p.stripeAccountId === 'string' && p.stripeAccountId.startsWith('acct_');
  const booking = new URLSearchParams({ hours: String(hours), region, city });
  for (const key of ['date', 'time', 'service']) if (typeof search[key] === 'string') booking.set(key, search[key] as string);
  if (booking.get('service') === 'both') booking.set('service', 'loading');
  return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto px-4 max-w-5xl space-y-6"><Link className="underline" href={`/movers/${region}/${city}/results?${booking}`}>← Providers near {place.city}</Link>
    <section className="bg-white rounded-3xl border p-6 sm:p-10 space-y-5"><h1 className="text-4xl font-bold text-primary">{String(p.businessName || 'Moving provider')}</h1><p className="whitespace-pre-wrap text-slate-600">{String(p.bio || '')}</p><p>{Number(p.reviewCount) > 0 ? `${Number(p.rating || 0).toFixed(1)} / 5 · ${p.reviewCount} reviews` : 'No reviews yet'}</p><h2 className="text-xl font-bold">Services offered</h2><p>{Array.isArray(p.services) ? p.services.map((service: string) => service.replace(/-/g,' ')).join(' · ') : 'Contact the provider for service details.'}</p>
      {bookable ? <div className="rounded-2xl bg-slate-50 p-5 space-y-3"><p className="text-2xl font-bold">${p.hourlyRate.toFixed(2)} per hour</p><p>{p.minimumHours}-hour minimum · ${Number(p.hourlyRate * hours).toFixed(2)} for {hours} hours</p><p className="text-sm">Your date and time are preferences to confirm with the provider. Review your addresses, reserved hours and final total before payment.</p><Button asChild className="rounded-full"><Link href={`/book/${providerId}?${booking}`}>Customize booking</Link></Button></div> : <p>This provider must complete their pricing or payment setup before taking bookings.</p>}
    </section><section className="space-y-4"><h2 className="text-2xl font-bold">Customer reviews</h2>{reviews.empty ? <p>No customer reviews yet.</p> : reviews.docs.map(review => { const r = review.data(); return <article key={review.id} className="bg-white border rounded-xl p-5"><p>{Number(r.rating || 0)} / 5</p><p className="whitespace-pre-wrap mt-2">{String(r.comment || r.review || r.text || '')}</p>{r.incentivized && <p className="text-xs mt-3">Reviewer received a review incentive.</p>}</article>; })}</section>
  </div></div></PublicLayout>;
}
