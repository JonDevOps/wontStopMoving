'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'next/navigation';

type Provider = { id: string; name: string; bio: string; hourlyRate: number; minimumHours: number; services: string[]; rating: number; reviewCount: number; jobsCompleted: number | null; distance: number | null };
export function MoverResults({ region, city }: { region: string; city: string }) {
  const search = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [coverageLocated, setCoverageLocated] = useState(true);
  const [sort, setSort] = useState('rating'), [name, setName] = useState('');
  const [hours, setHours] = useState(2), [service, setService] = useState('loading');
  useEffect(() => { const requested = search.get('service') || 'loading'; setService(['packing','cleaning','heavy'].includes(requested) ? requested : 'loading'); setHours(Math.max(2,Math.min(24,Math.floor(Number(search.get('hours')) || 2)))); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setProviders([]);
    fetch(`/api/movers/${region}/${city}?date=${encodeURIComponent(search.get('date') || '')}`, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then(data => { setProviders(data.providers); setCoverageLocated(data.coverageLocated); }).catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Search unavailable.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [region, city, search]);
  const price = (provider: Provider) => provider.hourlyRate * Math.max(hours, provider.minimumHours);
  const filtered = providers.filter(provider => provider.name.toLowerCase().includes(name.toLowerCase()) && provider.services.includes(service)).sort((a,b) => sort === 'lowest' ? price(a)-price(b) : sort === 'highest' ? price(b)-price(a) : sort === 'jobs' ? (b.jobsCompleted || 0)-(a.jobsCompleted || 0) : b.rating-a.rating || b.reviewCount-a.reviewCount || a.name.localeCompare(b.name));
  function profileUrl(provider: Provider) { const params = new URLSearchParams(); for (const key of ['date','time']) { const value = search.get(key); if (value) params.set(key, value); } params.set('service', service === 'loading' && ['both','unloading'].includes(search.get('service') || '') ? search.get('service')! : service); params.set('hours', String(Math.max(hours, provider.minimumHours))); return `/movers/${region}/${city}/providers/${provider.id}?${params}`; }
  const control = 'w-full border border-slate-300 rounded-xl bg-white p-3 min-h-12';
  return <div className="grid md:grid-cols-[260px_1fr] gap-6 items-start">
    <aside className="bg-white rounded-2xl border p-5 space-y-5"><h2 className="font-bold text-xl">Sort & filter</h2><div className="space-y-2"><Label htmlFor="mover-sort">Sort by</Label><select id="mover-sort" className={control} value={sort} onChange={e => setSort(e.target.value)}><option value="rating">Customer rating</option><option value="lowest">Lowest total price</option><option value="highest">Highest total price</option><option value="jobs">Most completed jobs</option></select></div>
      <div className="space-y-2"><Label htmlFor="mover-hours">Number of hours</Label><select id="mover-hours" className={control} value={hours} onChange={e => setHours(Number(e.target.value))}>{Array.from({length:23},(_,index) => index+2).map(value => <option key={value} value={value}>{value} hours</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="mover-service">Service</Label><select id="mover-service" className={control} value={service} onChange={e => setService(e.target.value)}><option value="loading">Loading / unloading</option><option value="packing">Packing</option><option value="cleaning">Cleaning</option><option value="heavy">Heavy items</option></select></div>
      <p className="text-sm text-slate-600">At least $45 per hour and two hours per booking. Providers may set higher rates and minimums.</p><Link className="underline text-sm" href={`/movers/${region}/${city}`}>Change search details</Link>
    </aside>
    <section className="space-y-4"><p className="font-semibold">Requested: {search.get('date') || 'Date not selected'} · {search.get('time') || 'Start time not selected'}</p><div><Label htmlFor="mover-business">Search by business name</Label><Input id="mover-business" value={name} onChange={e => setName(e.target.value)} placeholder="Provider name" className="bg-white min-h-12 mt-2"/></div>
      <p className="text-sm text-slate-600">Nearby providers within 50 miles of the approximate city center, or providers explicitly covering this city. Canadian city coordinates: <a href="https://www.geonames.org/" className="underline" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0). Your selected date and time are preferences; availability must be confirmed. Rates are for the provider’s advertised crew.</p>
      {loading ? <p role="status">Finding providers…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : !filtered.length ? <div className="bg-white rounded-2xl p-8 border"><h2 className="text-xl font-bold">No matching bookable providers to show yet</h2><p className="mt-3">Try another service or nearby city, or contact our team for help.</p>{!coverageLocated && <p className="text-sm mt-3">Coverage can currently be confirmed here only for providers that explicitly list this city.</p>}<Button asChild className="mt-5"><Link href="/contact">Contact our team</Link></Button></div> : filtered.map(provider => <article key={provider.id} className="bg-white rounded-2xl border p-5 sm:p-7 flex flex-col lg:flex-row gap-5"><div className="bg-primary/5 text-primary w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" aria-hidden="true">{provider.name.slice(0,1)}</div><div className="flex-1 space-y-3 min-w-0"><h2 className="text-xl font-bold text-primary"><Link href={profileUrl(provider)}>{provider.name}</Link></h2><p className="text-sm text-slate-600 whitespace-pre-wrap">{provider.bio}</p><p className="text-sm">{provider.reviewCount > 0 ? `${provider.rating.toFixed(1)} / 5 · ${provider.reviewCount} reviews` : 'No reviews yet'}{provider.jobsCompleted !== null ? ` · ${provider.jobsCompleted} completed jobs` : ''}{provider.distance !== null ? ` · ${provider.distance} miles from city center` : ''}</p><p className="text-sm">${provider.hourlyRate.toFixed(2)}/hour · {provider.minimumHours}-hour minimum</p></div><div className="space-y-3 lg:text-right shrink-0"><p className="text-2xl font-bold text-primary">${price(provider).toFixed(2)}</p><p className="text-sm">{Math.max(hours,provider.minimumHours)} hours · USD service subtotal</p><Button asChild className="rounded-full bg-accent hover:bg-accent/90"><Link href={profileUrl(provider)}>Customize & Book</Link></Button></div></article>)}
    </section>
  </div>;
}
