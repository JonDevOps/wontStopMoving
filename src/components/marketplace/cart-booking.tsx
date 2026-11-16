'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MOVER_CART_KEY, moverCartItem, type MoverCartItem } from '@/lib/mover-cart';

export function CartBooking({ providerId, region, city }: { providerId: string; region: string; city: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState<{ businessName: string; hourlyRate: number; minimumHours: number; services: string[] } | null>(null);
  const [hours, setHours] = useState(2), [date, setDate] = useState(''), [time, setTime] = useState('morning'), [service, setService] = useState('loading');
  const [pickup, setPickup] = useState(''), [dropoff, setDropoff] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/movers/providers/${providerId}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error('Provider unavailable for booking.'); return response.json(); }).then(data => {
      setProvider(data);
      const params = new URLSearchParams(window.location.search);
      setHours(Math.max(data.minimumHours, Math.min(24, Number(params.get('hours')) || 2)));
      setDate(params.get('date') || ''); setTime(params.get('time') || 'morning'); setService(params.get('service') === 'both' ? 'loading' : params.get('service') || 'loading');
      try {
        const saved = JSON.parse(sessionStorage.getItem('wsm-mover-search') || 'null');
        if (saved?.region === region && saved.city === city && saved.date === params.get('date')) {
          setPickup(saved.type === 'unloading' ? '' : String(saved.address || ''));
          setDropoff(saved.type === 'unloading' ? String(saved.address || '') : String(saved.unloadingAddress || ''));
        }
      } catch { /* Addresses can be entered manually. */ }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [providerId, region, city]);
  function add(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!provider) return;
    const parsed = moverCartItem.safeParse({ id: crypto.randomUUID(), providerId, providerName: provider.businessName, hours, moveDate: date, service, preferredStartTime: time, pickupAddress: pickup, dropoffAddress: dropoff, region, city, quotedRate: provider.hourlyRate });
    if (!parsed.success || hours < provider.minimumHours) { setError('Check the date, addresses and minimum hours.'); return; }
    try {
      const existing: MoverCartItem[] = JSON.parse(sessionStorage.getItem(MOVER_CART_KEY) || '[]');
      if (!Array.isArray(existing) || existing.length >= 10) throw new Error('Your cart is full. Review it before adding another crew.');
      sessionStorage.setItem(MOVER_CART_KEY, JSON.stringify([...existing, parsed.data]));
      router.push('/movers/cart');
    } catch (e) { setError(e instanceof Error ? e.message : 'Your browser could not save this cart.'); }
  }
  if (!provider) return <p role="status">{error || 'Loading your provider…'}</p>;
  const control = 'w-full min-h-12 border rounded-xl p-3 bg-white';
  return <form onSubmit={add} className="bg-white border rounded-3xl p-6 sm:p-10 space-y-6">
    <h1 className="text-3xl font-bold">Customize {provider.businessName}</h1>
    <p>${provider.hourlyRate.toFixed(2)}/hour · {provider.minimumHours}-hour minimum. This reservation is for one crew and service.</p>
    <div className="grid sm:grid-cols-2 gap-5">
      <div><Label htmlFor="cart-service">Service</Label><select id="cart-service" value={service} onChange={e => setService(e.target.value)} className={control}>{['loading','unloading','packing','cleaning','heavy'].filter(value => provider.services.includes(value === 'unloading' ? 'loading' : value)).map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      <div><Label htmlFor="cart-hours">Hours</Label><Input id="cart-hours" type="number" min={provider.minimumHours} max={24} step={1} required value={hours} onChange={e => setHours(Number(e.target.value))}/></div>
      <div><Label htmlFor="cart-date">Service date</Label><Input id="cart-date" type="date" required value={date} onChange={e => setDate(e.target.value)}/></div>
      <div><Label htmlFor="cart-time">Preferred start time</Label><select id="cart-time" value={time} onChange={e => setTime(e.target.value)} className={control}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></div>
    </div>
    <div><Label htmlFor="cart-pickup">Pickup address</Label><Input id="cart-pickup" required minLength={5} maxLength={300} value={pickup} onChange={e => setPickup(e.target.value)}/></div>
    <div><Label htmlFor="cart-dropoff">Drop-off address</Label><Input id="cart-dropoff" required minLength={5} maxLength={300} value={dropoff} onChange={e => setDropoff(e.target.value)}/></div>
    <p className="text-2xl font-bold">Service subtotal: ${(hours * provider.hourlyRate).toFixed(2)}</p>
    <p className="text-sm text-slate-600">Add another reservation for your unloading crew if needed. Each reservation has its own payment code and payout. Your date and time must be confirmed with the provider.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <Button type="submit">Add crew to cart</Button>
  </form>;
}
