'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { CONCIERGE_SERVICES, CONCIERGE_STATUSES, type ConciergeService, type ConciergeStatus } from '@/lib/concierge';

type Request = { id: string; service: ConciergeService; status: ConciergeStatus; note: string; customerName: string; customerEmail: string; customerPhone: string; moveDate: string; pickupAddress: string; dropoffAddress: string; partnerId?: string; partnerName?: string; referralFee?: number | null; adminNote?: string; createdAt: string | null };
type Partner = { id: string; name: string; services: ConciergeService[]; phone: string; email: string; website: string; area: string; feeNote: string; active: boolean };

function RequestRow({ r, partners, onSave }: { r: Request; partners: Partner[]; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [status, setStatus] = useState(r.status);
  const [partnerId, setPartnerId] = useState(r.partnerId || '');
  const [fee, setFee] = useState(r.referralFee != null ? String(r.referralFee) : '');
  const [note, setNote] = useState(r.adminNote || '');
  const [busy, setBusy] = useState(false);
  const fits = partners.filter(p => p.active && p.services.includes(r.service));
  return (
    <li className="bg-white rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-bold">{CONCIERGE_SERVICES[r.service]?.label || r.service} <Badge variant="outline">{CONCIERGE_STATUSES[r.status]}</Badge></p>
          <p className="text-sm text-muted-foreground">{r.customerName} · {r.customerEmail}{r.customerPhone ? ` · ${r.customerPhone}` : ''} · move {r.moveDate || 'TBD'}</p>
          <p className="text-xs text-muted-foreground">{r.pickupAddress} → {r.dropoffAddress}</p>
          {r.note && <p className="text-sm mt-1">“{r.note}”</p>}
        </div>
        <p className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_2fr_auto]">
        <select aria-label="Partner" className="h-10 rounded-md border px-2 text-sm bg-white" value={partnerId} onChange={e => setPartnerId(e.target.value)}>
          <option value="">{fits.length ? 'Choose a partner…' : 'No partner for this yet'}</option>
          {fits.map(p => <option key={p.id} value={p.id}>{p.name}{p.area ? ` (${p.area})` : ''}</option>)}
        </select>
        <select aria-label="Status" className="h-10 rounded-md border px-2 text-sm bg-white" value={status} onChange={e => setStatus(e.target.value as ConciergeStatus)}>
          {(Object.keys(CONCIERGE_STATUSES) as ConciergeStatus[]).map(s => <option key={s} value={s}>{CONCIERGE_STATUSES[s]}</option>)}
        </select>
        <Input aria-label="Referral fee" inputMode="decimal" placeholder="Fee $" value={fee} onChange={e => setFee(e.target.value.replace(/[^0-9.]/g, ''))} />
        <Input aria-label="Note" placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
        <Button disabled={busy} onClick={() => { setBusy(true); void onSave({ action: 'request', id: r.id, status, partnerId: partnerId || undefined, referralFee: fee ? Number(fee) : undefined, adminNote: note }).finally(() => setBusy(false)); }}>Save</Button>
      </div>
      {status === 'introduced' && r.status === 'new' && partnerId && <p className="text-xs text-muted-foreground">Saving emails the customer this partner’s contact details.</p>}
    </li>
  );
}

function Concierge() {
  const auth = useAuth();
  const [data, setData] = useState<{ requests: Request[]; partners: Partner[] } | null>(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', website: '', area: '', feeNote: '', services: [] as ConciergeService[] });
  const load = useCallback(async () => {
    try { setData(await apiFetch(auth, '/api/admin/concierge')); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not load.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  const save = async (body: Record<string, unknown>) => {
    try { await apiFetch(auth, '/api/admin/concierge', body); setNotice('Saved.'); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
  };
  const open = (data?.requests || []).filter(r => r.status !== 'closed');
  const fees = (data?.requests || []).filter(r => r.status === 'booked').reduce((n, r) => n + (r.referralFee || 0), 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-black text-primary uppercase">Moving concierge</h1>
        <p className="text-muted-foreground">Customers ask for extra services from their move page. Introduce a partner, then track bookings and referral fees.</p>
        {data && <p className="font-bold mt-2">{open.length} open · ${fees.toLocaleString()} in referral fees from booked requests</p>}
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!data ? <p>Loading…</p> : <ul className="space-y-3">{data.requests.length ? data.requests.map(r => <RequestRow key={`${r.id}:${r.status}`} r={r} partners={data.partners} onSave={save} />) : <p className="text-muted-foreground">No requests yet.</p>}</ul>}

      <section className="space-y-3">
        <h2 className="text-xl font-black text-primary">Partners ({data?.partners.length ?? 0})</h2>
        <ul className="grid sm:grid-cols-2 gap-2">{(data?.partners || []).map(p => (
          <li key={p.id} className="bg-white rounded-xl p-3 text-sm">
            <p className="font-bold">{p.name} {!p.active && <Badge variant="outline">inactive</Badge>}</p>
            <p className="text-xs text-muted-foreground">{p.services.map(s => CONCIERGE_SERVICES[s]?.label || s).join(', ')}</p>
            <p className="text-xs">{[p.area, p.phone, p.email].filter(Boolean).join(' · ')}{p.feeNote ? ` · fee: ${p.feeNote}` : ''}</p>
            <button type="button" className="text-xs underline mt-1" onClick={() => void save({ ...p, action: 'partner', active: !p.active })}>{p.active ? 'Mark inactive' : 'Mark active'}</button>
          </li>
        ))}</ul>
        <form className="bg-white rounded-xl p-4 space-y-2" onSubmit={e => { e.preventDefault(); void save({ action: 'partner', ...form }).then(() => setForm({ name: '', phone: '', email: '', website: '', area: '', feeNote: '', services: [] })); }}>
          <p className="font-bold">Add a partner</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input aria-label="Partner name" placeholder="Business name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input aria-label="Phone" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input aria-label="Email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input aria-label="Website" placeholder="https://…" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            <Input aria-label="Area" placeholder="Area served (e.g. Bay Area)" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
            <Input aria-label="Referral fee" placeholder="Referral fee (e.g. 10%)" value={form.feeNote} onChange={e => setForm(f => ({ ...f, feeNote: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2">{(Object.keys(CONCIERGE_SERVICES) as ConciergeService[]).map(s => (
            <label key={s} className="text-xs inline-flex items-center gap-1 border rounded-full px-2 py-1"><input type="checkbox" checked={form.services.includes(s)} onChange={e => setForm(f => ({ ...f, services: e.target.checked ? [...f.services, s] : f.services.filter(x => x !== s) }))} />{CONCIERGE_SERVICES[s].label}</label>
          ))}</div>
          <Button type="submit" disabled={!form.name || !form.services.length}>Add partner</Button>
        </form>
      </section>
    </div>
  );
}

export default function AdminConciergePage() { return <EmployeeLayout isAdmin><Concierge /></EmployeeLayout>; }
