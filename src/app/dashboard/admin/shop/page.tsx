'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { FULFILLMENT, type Fulfillment } from '@/lib/shop';

type Order = { id: string; status: string; fulfillment: Fulfillment; jobId: string | null; lines: { name: string; qty: number; total: number }[]; total: number; notes: string; email: string; phone: string | null; shipping: { name: string; address: Record<string, string> | null } | null; adminNote: string; createdAt: string | null; paidAt: string | null };

function ShopOrders() {
  const auth = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<{ orders: Order[]; statuses: Record<string, string> } | null>(null);
  const [show, setShow] = useState('open');
  const load = useCallback(() => apiFetch(auth, '/api/admin/shop').then(setData).catch(e => toast({ variant: 'destructive', title: 'Couldn’t load orders', description: e instanceof Error ? e.message : '' })), [auth, toast]);
  useEffect(() => { void load(); }, [load]);
  const update = async (id: string, body: Record<string, unknown>, ok: string) => {
    try { await apiFetch(auth, '/api/admin/shop', { id, ...body }); toast({ title: ok }); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'That didn’t work', description: e instanceof Error ? e.message : '' }); }
  };
  const orders = (data?.orders || []).filter(o => show === 'all' || (show === 'open' ? ['paid', 'ready', 'out-for-delivery'].includes(o.status) : o.status === show));
  return <div className="space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2"><h1 className="text-3xl font-bold">Supplies orders</h1><p className="text-muted-foreground">Orders from the moving supplies shop. Mark them ready or out for delivery (the customer is emailed), then delivered.</p></div>
    <select aria-label="Show" className="h-10 border rounded-md px-2 bg-white text-sm" value={show} onChange={e => setShow(e.target.value)}><option value="open">To fulfill</option><option value="fulfilled">Delivered / picked up</option><option value="pending">Unpaid</option><option value="all">All</option></select>
    {!data ? <p>Loading…</p> : !orders.length ? <p className="text-muted-foreground">No orders here.</p> : orders.map(o => <Card key={o.id} className="bg-white"><CardContent className="p-5 space-y-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold text-lg">${o.total.toFixed(2)} · {FULFILLMENT[o.fulfillment]?.label}</p><p className="text-muted-foreground">{o.email}{o.phone ? ` · ${o.phone}` : ''} · {o.paidAt ? `paid ${new Date(o.paidAt).toLocaleString()}` : 'not paid'}{o.jobId ? ` · move ${o.jobId}` : ''}</p></div>
        <select aria-label="Status" className="h-9 border rounded-md px-2 bg-white" value={o.status} onChange={e => void update(o.id, { status: e.target.value }, 'Status updated')}>{Object.entries(data.statuses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <ul>{o.lines.map(l => <li key={l.name}>{l.qty} × {l.name} (${l.total.toFixed(2)})</li>)}</ul>
      {o.shipping?.address && <p>Deliver to: {o.shipping.name}, {[o.shipping.address.line1, o.shipping.address.line2, o.shipping.address.city, o.shipping.address.state, o.shipping.address.postal_code].filter(Boolean).join(', ')}</p>}
      {o.notes && <p>Customer notes: {o.notes}</p>}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void update(o.id, { adminNote: String(new FormData(e.currentTarget).get('note') || '') }, 'Note saved'); }}><input name="note" defaultValue={o.adminNote} placeholder="Internal note" className="flex-1 h-9 border rounded-md px-2" /><Button size="sm" variant="outline" type="submit">Save</Button></form>
    </CardContent></Card>)}
  </div>;
}

export default function AdminShopPage() { return <EmployeeLayout isAdmin><ShopOrders /></EmployeeLayout>; }
