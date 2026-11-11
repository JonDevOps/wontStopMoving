'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { CATALOG, FREE_DELIVERY_OVER, FULFILLMENT, priceCart, SALES_TAX_RATE, type CartLine, type Fulfillment } from '@/lib/shop';

const CART_KEY = 'wsm-shop-cart';
const money = (n: number) => `$${n.toFixed(2)}`;
type Move = { id: string; moveDate: string; pickupAddress: string };

export default function ShopPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [moves, setMoves] = useState<Move[]>([]);
  const [jobId, setJobId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(saved)) setCart(saved); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }, [cart]);
  useEffect(() => {
    if (!user) return;
    apiFetch<{ moves: Move[] }>(auth, '/api/shop/orders').then(r => { setMoves(r.moves); if (r.moves[0]) { setJobId(r.moves[0].id); setFulfillment('with-move'); } }).catch(() => {});
  }, [user, auth]);

  const priced = useMemo(() => priceCart(cart, fulfillment), [cart, fulfillment]);
  const qtyOf = (id: string) => cart.find(l => l.id === id)?.qty || 0;
  const setQty = (id: string, qty: number) => setCart(c => (qty <= 0 ? c.filter(l => l.id !== id) : c.some(l => l.id === id) ? c.map(l => (l.id === id ? { ...l, qty } : l)) : [...c, { id, qty }]));
  const categories = [...new Set(CATALOG.map(i => i.category))];

  const checkout = async () => {
    setError(''); setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(auth, '/api/shop/checkout', { items: cart, fulfillment, jobId: fulfillment === 'with-move' ? jobId : undefined, notes });
      window.location.href = url;
    } catch (e) { setError(e instanceof Error ? e.message : 'Checkout failed.'); setBusy(false); }
  };

  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black text-primary uppercase tracking-tighter">Moving <span className="text-accent">supplies</span></h1>
            <p className="text-muted-foreground text-lg">Boxes, kits and packing materials, brought with your move, delivered in the Bay Area, or picked up in Mountain View.</p>
          </header>
          {categories.map(cat => <section key={cat} className="space-y-3">
            <h2 className="text-xl font-black text-primary">{cat === 'Kits' ? 'Complete moving kits' : cat}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {CATALOG.filter(i => i.category === cat).map(item => { const q = qtyOf(item.id); return <div key={item.id} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex gap-3"><Package className="h-6 w-6 text-accent shrink-0" /><div><p className="font-bold text-primary">{item.name}</p><p className="text-sm text-muted-foreground">{item.description}</p></div></div>
                <div className="flex items-center justify-between mt-auto"><p className="font-black text-lg">{money(item.price)}{item.unit ? <span className="text-xs font-normal text-muted-foreground"> {item.unit}</span> : ''}</p>
                  {q ? <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label={`Remove one ${item.name}`} onClick={() => setQty(item.id, q - 1)}><Minus className="h-4 w-4" /></Button><span className="w-8 text-center font-bold" aria-live="polite">{q}</span><Button size="icon" variant="outline" aria-label={`Add one ${item.name}`} onClick={() => setQty(item.id, q + 1)}><Plus className="h-4 w-4" /></Button></div>
                    : <Button size="sm" onClick={() => setQty(item.id, item.category === 'Boxes' && item.price < 5 ? 10 : 1)}>Add{item.category === 'Boxes' && item.price < 5 ? ' 10' : ''}</Button>}
                </div>
              </div>; })}
            </div>
          </section>)}
        </div>

        <aside className="lg:sticky lg:top-28 h-fit bg-white rounded-3xl shadow-xl p-6 space-y-4">
          <h2 className="font-black text-xl text-primary flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Your order</h2>
          {!priced ? <p className="text-sm text-muted-foreground">Your cart is empty. Kits are the easiest place to start.</p> : <>
            <ul className="space-y-2 text-sm">{priced.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.qty} × {l.name}</span><span className="flex items-center gap-2">{money(l.total)}<button aria-label={`Remove ${l.name}`} onClick={() => setQty(l.id, 0)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button></span></li>)}</ul>
            <fieldset className="space-y-2"><legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">How you’ll get it</legend>
              {(Object.keys(FULFILLMENT) as Fulfillment[]).map(f => <label key={f} className={`flex gap-2 text-sm p-2 rounded-lg border ${fulfillment === f ? 'border-accent bg-accent/5' : ''} ${f === 'with-move' && !moves.length ? 'opacity-50' : ''}`}>
                <input type="radio" name="fulfillment" disabled={f === 'with-move' && !moves.length} checked={fulfillment === f} onChange={() => setFulfillment(f)} />
                <span><b>{FULFILLMENT[f].label}</b><br /><span className="text-muted-foreground">{f === 'with-move' && !moves.length ? 'Book a move to choose this.' : FULFILLMENT[f].note}</span></span>
              </label>)}
            </fieldset>
            {fulfillment === 'with-move' && moves.length > 1 && <select aria-label="Which move" className="w-full h-10 border rounded-md px-2 text-sm bg-white" value={jobId} onChange={e => setJobId(e.target.value)}>{moves.map(m => <option key={m.id} value={m.id}>{m.moveDate || 'Move'} · {m.pickupAddress}</option>)}</select>}
            <Textarea rows={2} placeholder="Notes (gate code, best delivery time…)" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="text-sm space-y-1 border-t pt-3">
              <p className="flex justify-between"><span>Subtotal</span><span>{money(priced.subtotal)}</span></p>
              {fulfillment === 'delivery' && <p className="flex justify-between"><span>Delivery{priced.delivery ? ` (free over $${FREE_DELIVERY_OVER})` : ''}</span><span>{priced.delivery ? money(priced.delivery) : 'Free'}</span></p>}
              <p className="flex justify-between"><span>Sales tax ({(SALES_TAX_RATE * 100).toFixed(3).replace(/0+$/, '')}%)</span><span>{money(priced.tax)}</span></p>
              <p className="flex justify-between font-black text-lg"><span>Total</span><span>{money(priced.total)}</span></p>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {isUserLoading ? null : user ? <Button className="w-full h-12 font-black uppercase" disabled={busy} onClick={checkout}>{busy ? 'Opening checkout…' : 'Checkout'}</Button>
              : <Button asChild className="w-full h-12 font-black uppercase"><Link href="/login?role=customer&redirect=%2Fshop">Sign in to check out</Link></Button>}
            <p className="text-xs text-muted-foreground">Secure payment through Stripe. Your cart is saved on this device.</p>
          </>}
        </aside>
      </div>
    </div>
  </PublicLayout>;
}
