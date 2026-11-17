'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MOVER_REGIONS } from '@/lib/mover-regions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function MoverSearch({ initialRegion = '', initialCity = '', initialType = 'loading' }: { initialRegion?: string; initialCity?: string; initialType?: string }) {
  const router = useRouter();
  const [region, setRegion] = useState(initialRegion);
  const [city, setCity] = useState(initialCity);
  const [cities, setCities] = useState<{ name: string; slug: string }[]>([]);
  const [type, setType] = useState(initialType);
  const [address, setAddress] = useState('');
  useEffect(() => {
    if (initialType !== 'unloading') return;
    try { const saved = JSON.parse(sessionStorage.getItem('wsm-mover-search') || 'null'); setAddress(saved?.unloadingAddress || (saved?.type === 'unloading' ? saved.address : '') || ''); } catch { /* Manual entry remains available. */ }
  }, [initialType]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!region) { setCities([]); return; }
    const controller = new AbortController(); setLoading(true); setCities([]);
    fetch(`/api/movers/locations?region=${encodeURIComponent(region)}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => { setCities(data.cities); setMessage(''); }).catch(error => { if (error.name !== 'AbortError') setMessage('Could not load cities. Try another state or refresh.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [region]);
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const selected = cities.find(item => item.name.toLowerCase() === city.trim().toLowerCase());
    if (!selected) { setMessage('Choose a city from the suggestions.'); return; }
    const data = new FormData(event.currentTarget);
    const date = String(data.get('date') || '');
    const today = new Date(); const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (date < localToday) { setMessage('Choose today or a future service date.'); return; }
    try { sessionStorage.setItem('wsm-mover-search', JSON.stringify({ region, city: selected.slug, type, address: data.get('address'), unloadingAddress: data.get('unloadingAddress') || '', date, time: data.get('time') })); }
    catch { setMessage('Your browser could not save the addresses. You can enter them again at booking.'); }
    const params = new URLSearchParams({ date, time: String(data.get('time') || ''), service: type });
    router.push(`/movers/${region}/${selected.slug}/results?${params}`);
  }
  const selectClass = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 min-h-12';
  return <form onSubmit={search} className="rounded-3xl bg-white text-slate-900 shadow-2xl p-5 sm:p-8 space-y-6">
    <div><h2 className="text-2xl font-bold">Find your moving crew</h2><p className="text-sm text-slate-600 mt-1">Compare Wont Stop Moving providers near your service location.</p></div>
    <fieldset className="flex flex-wrap gap-3"><legend className="font-bold mb-2">What do you need help with?</legend>{[['loading', 'Loading'], ['unloading', 'Unloading'], ['both', 'Both']].map(([value, name]) => <label key={value} className={`rounded-full px-5 py-3 border cursor-pointer ${type === value ? 'bg-primary text-white border-primary' : 'border-slate-300'}`}><input type="radio" name="service" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only"/>{name}</label>)}</fieldset>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="mover-region">State or province</Label><select id="mover-region" required value={region} onChange={e => { setRegion(e.target.value); setCity(''); }} className={selectClass}><option value="">Choose a state or province</option>{Object.entries(MOVER_REGIONS).sort((a,b) => a[1].localeCompare(b[1])).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="mover-city">{type === 'both' ? 'Loading city' : 'Service city'}</Label><Input id="mover-city" list="mover-city-options" autoComplete="off" value={city} disabled={!region || loading} onChange={e => setCity(e.target.value)} required placeholder={loading ? 'Loading cities…' : 'Start typing your city'} className="min-h-12"/><datalist id="mover-city-options">{cities.map(item => <option key={item.slug} value={item.name}/>)}</datalist></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="mover-address">{type === 'unloading' ? 'Unloading address' : 'Loading address'}</Label><Input id="mover-address" name="address" value={address} onChange={e => setAddress(e.target.value)} required maxLength={300} autoComplete="street-address" placeholder="Full service address" className="min-h-12"/></div>
      {type === 'both' && <div className="space-y-2 sm:col-span-2"><Label htmlFor="mover-unloading-address">Unloading address (including city and state)</Label><Input id="mover-unloading-address" name="unloadingAddress" required maxLength={300} placeholder="Full unloading address" className="min-h-12"/></div>}
      <div className="space-y-2"><Label htmlFor="mover-date">Service date</Label><Input id="mover-date" name="date" type="date" required className="min-h-12"/></div>
      <div className="space-y-2"><Label htmlFor="mover-time">Preferred start time</Label><select id="mover-time" name="time" required className={selectClass}><option value="">Choose a time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></div>
    </div>
    {type === 'both' && <p className="text-sm text-slate-600">Choose your loading crew first, then add an unloading crew to the same cart. Each crew receives its own payment code.</p>}
    {message && <p role="alert" className="text-red-700">{message}</p>}
    <div className="flex flex-col sm:flex-row gap-4 sm:items-center"><Button type="submit" disabled={!region || loading} className="bg-accent hover:bg-accent/90 rounded-full min-h-14 px-8 font-bold text-lg">Find Movers</Button><Link href="/book" className="text-primary underline text-sm font-semibold">Book Our Team Directly</Link><Link href="/movers" className="underline text-sm">Browse all locations</Link></div>
  </form>;
}
