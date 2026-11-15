import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { moverRegion } from '@/lib/server/mover-locations';
import { slugify } from '@/lib/location-data';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }) { const {region} = await params; const place = moverRegion(region); return place ? pageMetadata({ title: `Moving providers in ${place.name}`, description: `Find Wont Stop Moving providers by city in ${place.name}.`, path: `/movers/${region}` }) : {}; }
export default async function RegionDirectory({ params }: { params: Promise<{ region: string }> }) { const { region } = await params; const place = moverRegion(region); if (!place) notFound(); return <PublicLayout><div className="container mx-auto px-4 pt-32 pb-20 max-w-6xl space-y-6"><Link className="underline" href="/movers">← All states and provinces</Link><h1 className="text-4xl font-bold text-primary">Movers in {place.name}</h1><p>Choose a city to search for marketplace providers.</p><ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{place.cities.map(city => <li key={slugify(city)}><Link className="block p-3 border rounded-xl text-primary hover:border-accent" href={`/movers/${region}/${slugify(city)}`}>{city}</Link></li>)}</ul></div></PublicLayout>; }
