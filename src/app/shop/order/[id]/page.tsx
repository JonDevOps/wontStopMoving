'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { PublicLayout } from '@/components/layout/public-layout';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { FULFILLMENT, ORDER_STATUSES, type Fulfillment, type OrderStatus } from '@/lib/shop';

type Order = { id: string; status: OrderStatus; fulfillment: Fulfillment; lines: { name: string; qty: number; total: number }[]; subtotal: number; delivery: number; tax: number; total: number; createdAt: string | null };

export default function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    (async () => {
      const sessionId = new URLSearchParams(window.location.search).get('session_id');
      if (sessionId) { try { await apiFetch(auth, '/api/stripe/verify-session', { sessionId }); } catch { /* the webhook confirms it too */ } }
      try { localStorage.removeItem('wsm-shop-cart'); } catch { /* ignore */ }
      const { orders } = await apiFetch<{ orders: Order[] }>(auth, '/api/shop/orders');
      const o = orders.find(x => x.id === id);
      if (o) setOrder(o); else setError('Order not found for this account.');
    })().catch(e => setError(e instanceof Error ? e.message : 'Could not load your order.'));
  }, [user, auth, id]);
  const money = (n: number) => `$${n.toFixed(2)}`;
  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 pb-24">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {isUserLoading ? <p>Loading…</p> : !user ? <p>Please <Link className="underline" href={`/login?role=customer&redirect=${encodeURIComponent(`/shop/order/${id}`)}`}>sign in</Link> to see your order.</p>
          : error ? <p role="alert">{error}</p> : !order ? <p>Loading your order…</p> : <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 space-y-4">
            <p className="flex items-center gap-2 text-2xl font-black text-primary"><CheckCircle2 className="h-7 w-7 text-green-600" />{order.status === 'pending' ? 'Finishing your payment…' : 'Order confirmed'}</p>
            <p className="font-semibold">{ORDER_STATUSES[order.status]}</p>
            <p className="text-sm text-muted-foreground">{FULFILLMENT[order.fulfillment]?.note}</p>
            <ul className="text-sm space-y-1 border-t pt-3">{order.lines.map(l => <li key={l.name} className="flex justify-between"><span>{l.qty} × {l.name}</span><span>{money(l.total)}</span></li>)}</ul>
            <div className="text-sm border-t pt-3 space-y-1">
              {order.delivery > 0 && <p className="flex justify-between"><span>Delivery</span><span>{money(order.delivery)}</span></p>}
              <p className="flex justify-between"><span>Sales tax</span><span>{money(order.tax)}</span></p>
              <p className="flex justify-between font-black text-lg"><span>Total</span><span>{money(order.total)}</span></p>
            </div>
            <p className="text-sm">Questions? Call <a className="underline" href="tel:+14152145474">(415) 214-5474</a>. <Link className="underline ml-2" href="/shop">Back to the shop</Link></p>
          </div>}
      </div>
    </div>
  </PublicLayout>;
}
