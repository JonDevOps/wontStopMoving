import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { MoverSearch } from '@/components/marketplace/mover-search';
import { moverCity } from '@/lib/server/mover-locations';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ region: string; city: string }> }) { const {region,city} = await params; const place = moverCity(region,city); return place ? pageMetadata({ title: `Find movers in ${place.city}, ${place.name}`, description: `Compare Wont Stop Moving providers near ${place.city}. Search moving help by date and service.`, path: `/movers/${region}/${city}` }) : {}; }
export default async function CityMarketplace({ params }: { params: Promise<{ region: string; city: string }> }) { const { region, city } = await params; const place = moverCity(region,city); if (!place) notFound(); return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto px-4 max-w-5xl space-y-6"><Link className="underline" href={`/movers/${region}`}>← Cities in {place.name}</Link><h1 className="text-4xl font-bold text-primary">Find movers in {place.city}, {place.name}</h1><p>Choose your service details to compare nearby providers.</p><MoverSearch initialRegion={region} initialCity={place.city}/><Link className="block underline text-sm" href={`/locations/${place.slug}/${city}`}>Explore our direct moving service in {place.city}</Link></div></div></PublicLayout>; }
