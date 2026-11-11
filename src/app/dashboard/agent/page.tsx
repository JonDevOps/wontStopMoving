'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AgentLayout } from '@/components/layout/agent-layout';
import { JobTeamPanel } from '@/components/jobs/job-team-panel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { AGENT_ROLES, AGENT_SERVICES, VETTING_CHECKS, type AgentRole, COUNTRY_NAMES, REGION_BY_CODE, REGIONS, type Country } from '@/lib/agents';

type Agent = Record<string, any> & { companyName: string; status: string; roles: AgentRole[]; services: string[]; serviceRegions: string[]; vettingDone: number };
type Shipment = { jobId: string; roles: string[]; response: string; status: string; moveDate: string; pickupAddress: string; dropoffAddress: string; moveSize: string; specialItems: string; customer: { name: string; phone: string; email: string } | null };
type DirEntry = { uid: string; companyName: string; city: string; region: string; country: string; phone: string; email: string; roles: string[]; serviceRegions: string[]; trucks: number; warehouseSqft: number };
const STATUS: Record<string, { label: string; text: string; cls: string }> = {
  pending: { label: 'Application under review', text: 'We’re verifying your authority, insurance and references. We’ll email you when you’re approved.', cls: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Approved agent', text: 'You’re in the network. Shipments we assign to you appear below.', cls: 'bg-green-100 text-green-900' },
  suspended: { label: 'Suspended', text: 'Your agent account is paused. Call (415) 214-5474 to resolve it.', cls: 'bg-red-100 text-red-900' },
  rejected: { label: 'Not approved', text: 'We couldn’t approve your application at this time. Call (415) 214-5474 with questions.', cls: 'bg-red-100 text-red-900' },
};
const regionName = (code: string) => REGION_BY_CODE.get(code)?.name || code;

function AgentDashboard() {
  const auth = useAuth();
  const [data, setData] = useState<{ agent: Agent | null; shipments: Shipment[]; directory: DirEntry[] } | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => apiFetch(auth, '/api/agents/me').then(setData).catch(e => setNotice(e instanceof Error ? e.message : 'Could not load your dashboard.')), [auth]);
  useEffect(() => { void load(); }, [load]);

  if (!data) return <p>{notice || 'Loading…'}</p>;
  if (!data.agent) return <Card className="bg-white"><CardContent className="p-8 space-y-3"><h1 className="text-2xl font-bold">Finish your application</h1><p className="text-muted-foreground">Tell us about your company to join the agent network.</p><Button asChild><Link href="/agents/apply">Continue application</Link></Button></CardContent></Card>;
  const a = data.agent, st = STATUS[a.status] || STATUS.pending;

  return <div className="space-y-8 max-w-5xl">
    <header className="space-y-3">
      <h1 className="text-3xl font-black uppercase">{a.companyName}</h1>
      <div className={`rounded-2xl p-4 ${st.cls}`}><p className="font-bold">{st.label}</p><p className="text-sm">{st.text}</p>
        {a.status === 'pending' && <p className="text-xs mt-1">Vetting: {a.vettingDone} of {Object.keys(VETTING_CHECKS).length} checks complete.</p>}
        {a.reviewNote && <p className="text-sm mt-1">Note from our team: {a.reviewNote}</p>}
      </div>
    </header>
    {notice && <p role="status" className="text-sm font-medium">{notice}</p>}
    <Shipments shipments={data.shipments} approved={a.status === 'approved'} onRespond={async (jobId, response) => { try { await apiFetch(auth, '/api/agents/me', { action: 'respond', jobId, response }); setNotice(response === 'accepted' ? 'Shipment accepted.' : 'Shipment declined. We’ll reassign it.'); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); } }} />
    <Company agent={a} onSave={async patch => { try { await apiFetch(auth, '/api/agents/me', { action: 'update', ...patch }); setNotice('Company details saved.'); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save.'); } }} />
    <Directory entries={data.directory} approved={a.status === 'approved'} />
  </div>;
}

function Shipments({ shipments, approved, onRespond }: { shipments: Shipment[]; approved: boolean; onRespond: (jobId: string, r: 'accepted' | 'declined') => void }) {
  return <section id="shipments" className="space-y-3 scroll-mt-24">
    <h2 className="text-xl font-black uppercase">Shipments</h2>
    {!shipments.length ? <p className="text-muted-foreground">{approved ? 'No shipments assigned yet. We’ll email you when one is.' : 'Shipments start once you’re approved.'}</p>
      : shipments.map(s => <Card key={s.jobId} className="bg-white"><CardContent className="p-5 space-y-2">
        <div className="flex flex-wrap justify-between gap-2">
          <p className="font-bold">{s.moveDate || 'Date to be confirmed'} · {s.roles.map(r => AGENT_ROLES[r as AgentRole] || r).join(', ')}</p>
          <Badge variant={s.response === 'accepted' ? 'default' : 'outline'}>{s.response === 'pending' ? 'Waiting for you' : s.response}</Badge>
        </div>
        <p className="text-sm">From: {s.pickupAddress || '—'}<br />To: {s.dropoffAddress || '—'}</p>
        <p className="text-sm text-muted-foreground">Size: {s.moveSize || '—'}{s.specialItems ? ` · Special items: ${s.specialItems}` : ''} · Job status: {s.status}</p>
        {s.customer && <p className="text-sm">Customer: {s.customer.name} · <a className="underline" href={`tel:${s.customer.phone}`}>{s.customer.phone}</a> · {s.customer.email}</p>}
        {s.response === 'pending' && <div className="flex gap-2 pt-1"><Button size="sm" onClick={() => onRespond(s.jobId, 'accepted')}>Accept</Button><Button size="sm" variant="outline" onClick={() => onRespond(s.jobId, 'declined')}>Decline</Button></div>}
        {s.response === 'accepted' && !s.customer && <p className="text-xs text-muted-foreground">Customer contact details appear here for accepted shipments.</p>}
        {s.response === 'accepted' && <details className="pt-2"><summary className="cursor-pointer text-sm font-bold text-primary">Team, updates and history</summary><div className="pt-3"><JobTeamPanel jobId={s.jobId} /></div></details>}
      </CardContent></Card>)}
  </section>;
}

function Company({ agent, onSave }: { agent: Agent; onSave: (patch: Record<string, unknown>) => void }) {
  const [f, setF] = useState(() => ({ phone: agent.phone || '', website: agent.website || '', trucks: String(agent.trucks ?? ''), availableTrucks: String(agent.availableTrucks ?? ''), tractors: String(agent.tractors ?? ''), warehouseSqft: String(agent.warehouseSqft ?? ''), employees: String(agent.employees ?? ''), capacityNote: agent.capacityNote || '', about: agent.about || '' }));
  const [roles, setRoles] = useState<AgentRole[]>(agent.roles || []);
  const [services, setServices] = useState<string[]>(agent.services || []);
  const [regions, setRegions] = useState<string[]>(agent.serviceRegions || []);
  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return <section id="company" className="space-y-3 scroll-mt-24">
    <h2 className="text-xl font-black uppercase">Company & capacity</h2>
    <Card className="bg-white"><CardContent className="p-5 space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        {([['phone', 'Phone'], ['website', 'Website'], ['trucks', 'Moving trucks'], ['availableTrucks', 'Trucks free this week'], ['tractors', 'Tractor-trailers'], ['warehouseSqft', 'Warehouse sq ft'], ['employees', 'Employees']] as [keyof typeof f, string][]).map(([k, l]) =>
          <label key={k} className="text-sm space-y-1"><span className="font-medium">{l}</span><Input value={f[k]} onChange={set(k)} /></label>)}
      </div>
      <label className="text-sm space-y-1 block"><span className="font-medium">Capacity note</span><Input placeholder="e.g. Fully booked Dec 20-31; storage space available" value={f.capacityNote} onChange={set('capacityNote')} /></label>
      <fieldset className="space-y-2"><legend className="font-medium text-sm">Roles</legend><div className="grid sm:grid-cols-2 gap-1">{(Object.keys(AGENT_ROLES) as AgentRole[]).map(r => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(roles, r, setRoles)} />{AGENT_ROLES[r]}</label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="font-medium text-sm">Services</legend><div className="grid sm:grid-cols-3 gap-1">{AGENT_SERVICES.map(s => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={services.includes(s)} onChange={() => toggle(services, s, setServices)} />{s}</label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="font-medium text-sm">Service area ({regions.length})</legend>
        {(Object.keys(COUNTRY_NAMES) as Country[]).map(c => <details key={c} className="bg-gray-50 rounded-lg p-2"><summary className="cursor-pointer text-sm font-bold">{COUNTRY_NAMES[c]} ({regions.filter(x => x.startsWith(`${c}-`)).length})</summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2">{REGIONS.filter(r => r.country === c).map(r => <label key={r.code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={regions.includes(r.code)} onChange={() => toggle(regions, r.code, setRegions)} />{r.name}</label>)}</div></details>)}
      </fieldset>
      <label className="text-sm space-y-1 block"><span className="font-medium">About</span><Textarea rows={3} value={f.about} onChange={set('about')} /></label>
      <Button onClick={() => onSave({ ...f, roles, services, serviceRegions: regions })}>Save company details</Button>
    </CardContent></Card>
  </section>;
}

function Directory({ entries, approved }: { entries: DirEntry[]; approved: boolean }) {
  const [region, setRegion] = useState('');
  const shown = useMemo(() => entries.filter(e => !region || e.serviceRegions.includes(region)), [entries, region]);
  return <section id="directory" className="space-y-3 scroll-mt-24">
    <h2 className="text-xl font-black uppercase">Network directory</h2>
    {!approved ? <p className="text-muted-foreground">The directory of other agents opens once you’re approved.</p> : <>
      <select className="border rounded-lg p-2 bg-white text-sm" value={region} onChange={e => setRegion(e.target.value)} aria-label="Filter by state or province"><option value="">All areas</option>{REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
      {!shown.length ? <p className="text-muted-foreground">No other agents {region ? `serve ${regionName(region)}` : 'yet'}.</p> :
        <div className="grid md:grid-cols-2 gap-3">{shown.map(e => <Card key={e.uid} className="bg-white"><CardContent className="p-4 text-sm space-y-1">
          <p className="font-bold">{e.companyName}</p>
          <p className="text-muted-foreground">{e.city}, {regionName(e.region)} · {e.trucks} trucks{e.warehouseSqft ? ` · ${e.warehouseSqft.toLocaleString()} sq ft warehouse` : ''}</p>
          <p>{e.roles.map(r => AGENT_ROLES[r as AgentRole] || r).join(' · ')}</p>
          <p><a className="underline" href={`tel:${e.phone}`}>{e.phone}</a> · <a className="underline" href={`mailto:${e.email}`}>{e.email}</a></p>
        </CardContent></Card>)}</div>}
    </>}
  </section>;
}

export default function AgentDashboardPage() { return <AgentLayout><AgentDashboard /></AgentLayout>; }
