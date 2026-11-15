import Link from 'next/link';
import { PublicLayout } from '@/components/layout/public-layout';
import { MoverSearch } from '@/components/marketplace/mover-search';
import { MOVER_REGIONS } from '@/lib/mover-regions';
import { moverRegion } from '@/lib/server/mover-locations';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Find Moving Providers', description: 'Browse Wont Stop Moving providers by state, province and city.', path: '/movers' });
export default function MoversDirectory() {
  return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto px-4 max-w-6xl space-y-10"><header className="space-y-4"><h1 className="text-4xl sm:text-5xl font-bold text-primary">Find movers with Wont Stop Moving</h1><p>Search your city or browse our moving-provider marketplace.</p></header><MoverSearch/><section><h2 className="text-2xl font-bold mb-5">Browse states and provinces</h2><ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Object.keys(MOVER_REGIONS).map(moverRegion).filter(region => !!region).sort((a,b) => a.name.localeCompare(b.name)).map(region => <li key={region.code}><Link className="block bg-white border rounded-xl p-4 text-primary hover:border-accent" href={`/movers/${region.code}`}>{region.name}</Link></li>)}</ul></section></div></div></PublicLayout>;
}
