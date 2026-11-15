import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { MoverResults } from '@/components/marketplace/mover-results';
import { moverCity } from '@/lib/server/mover-locations';

export const metadata = { title: 'Compare moving providers | Wont Stop Moving', robots: { index: false, follow: true } };
export default async function CityResults({ params }: { params: Promise<{ region: string; city: string }> }) { const {region,city} = await params; const place = moverCity(region,city); if (!place) notFound(); return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto px-4 max-w-6xl space-y-6"><nav aria-label="Breadcrumb" className="text-sm flex flex-wrap gap-2"><Link href="/movers">Movers</Link><span>/</span><Link href={`/movers/${region}`}>{place.name}</Link><span>/</span><Link href={`/movers/${region}/${city}`}>{place.city}</Link></nav><h1 className="text-3xl sm:text-4xl font-bold text-primary">Movers near {place.city}, {place.name}</h1><Suspense fallback={<p>Loading search…</p>}><MoverResults region={region} city={city}/></Suspense></div></div></PublicLayout>; }
