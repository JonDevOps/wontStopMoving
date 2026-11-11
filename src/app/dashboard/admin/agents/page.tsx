'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { AGENT_ROLES, PROSPECT_STAGES, VETTING_CHECKS, type AgentRole, type ProspectStage, type VettingKey, COUNTRY_NAMES, REGION_BY_CODE, REGIONS, type Country } from '@/lib/agents';

type Agent = Record<string, any> & { uid: string; companyName: string; status: string; vetting: Partial<Record<VettingKey, boolean>>; roles: string[]; serviceRegions: string[] };
type Region = { code: string; name: string; country: Country; agents: number; trucks: number; warehouseSqft: number; origin: number; destination: number };
type Prospect = { id: string; company: string; city: string; region: string; contact: string; phone: string; email: string; website: string; notes: string; stage: ProspectStage; nextFollowUp: string };
type Shipment = { id: string; moveDate: string; pickupAddress: string; dropoffAddress: string; state: string; status: string; agentAssignments: Record<string, string>; agentResponses: Record<string, string> };
type Data = { agents: Agent[]; totals: Record<string, number>; coverage: Region[]; prospects: Prospect[]; shipments: Shipment[] };
type Tab = 'overview' | 'vetting' | 'recruit' | 'shipments';
const regionName = (code: string) => REGION_BY_CODE.get(code)?.name || code || '—';
const STAGE_LABEL: Record<ProspectStage, string> = { prospect: 'To contact', contacted: 'Contacted', interested: 'Interested', applied: 'Applied', joined: 'Joined', declined: 'Not interested' };

function AgentNetwork() {
  const auth = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiFetch<Data>(auth, '/api/admin/agents').then(setData).catch(e => setNotice(e instanceof Error ? e.message : 'Could not load the network.')), [auth]);
  useEffect(() => { void load(); }, [load]);
  const post = useCallback(async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true); setNotice('');
    try { await apiFetch(auth, '/api/admin/agents', body); if (ok) setNotice(ok); await load(); return true; }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); return false; }
    finally { setBusy(false); }
  }, [auth, load]);

  const pending = data?.agents.filter(a => a.status === 'pending') || [];
  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Agent network</h1>
      <p className="text-muted-foreground">Established local moving companies across North America working as our origin, destination, hauling and storage agents. Vet them, fill coverage gaps, and hand off shipments.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {([['overview', 'Network & coverage'], ['vetting', `Applications (${pending.length})`], ['recruit', `Recruiting (${data?.prospects.filter(p => !['joined', 'declined'].includes(p.stage)).length ?? 0})`], ['shipments', 'Shipment handoffs']] as [Tab, string][]).map(([t, l]) =>
        <Button key={t} variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>{l}</Button>)}
    </div>
    {notice && <p role="status" className="text-sm font-medium bg-white border rounded-lg p-3">{notice}</p>}
    {!data ? <p>Loading…</p>
      : tab === 'overview' ? <Overview data={data} onRecruit={() => setTab('recruit')} />
      : tab === 'vetting' ? <Vetting agents={data.agents} busy={busy} post={post} />
      : tab === 'recruit' ? <Recruiting prospects={data.prospects} busy={busy} post={post} />
      : <Handoffs shipments={data.shipments} agents={data.agents.filter(a => a.status === 'approved')} busy={busy} post={post} />}
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card className="bg-white"><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-2xl font-black mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p></CardContent></Card>;
}

function Overview({ data, onRecruit }: { data: Data; onRecruit: () => void }) {
  const [country, setCountry] = useState<Country>('US');
  const t = data.totals;
  const regions = data.coverage.filter(r => r.country === country);
  const gaps = regions.filter(r => r.agents === 0);
  return <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <Stat label="Approved agents" value={t.approved} /><Stat label="Applications" value={t.pending} /><Stat label="Areas covered" value={`${t.covered} / ${data.coverage.length}`} />
      <Stat label="Trucks" value={t.trucks} /><Stat label="Tractor-trailers" value={t.tractors} /><Stat label="Warehouse sq ft" value={t.warehouseSqft} /><Stat label="Crew members" value={t.employees} />
    </div>
    <p className="text-sm text-muted-foreground">Van lines are measured by their agent networks: how many established companies, trucks and warehouses they can call on. These numbers count approved agents only.</p>
    <div className="flex flex-wrap gap-2">{(Object.keys(COUNTRY_NAMES) as Country[]).map(c => <Button key={c} size="sm" variant={country === c ? 'default' : 'outline'} onClick={() => setCountry(c)}>{COUNTRY_NAMES[c]}</Button>)}</div>
    {gaps.length > 0 && <Card className="bg-amber-50 border-amber-200"><CardContent className="p-4 space-y-2">
      <p className="font-bold">{gaps.length} of {regions.length} areas in {COUNTRY_NAMES[country]} have no agent yet</p>
      <p className="text-sm">{gaps.map(g => g.name).join(', ')}</p>
      <Button size="sm" variant="outline" onClick={onRecruit}>Recruit for these areas</Button>
    </CardContent></Card>}
    <Card className="bg-white"><CardContent className="p-0 overflow-x-auto">
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b">{['Area', 'Agents', 'Origin', 'Destination', 'Trucks', 'Warehouse sq ft'].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{regions.sort((a, b) => b.agents - a.agents || a.name.localeCompare(b.name)).map(r => <tr key={r.code} className={`border-b last:border-0 ${r.agents ? '' : 'text-muted-foreground'}`}>
          <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.agents || '—'}</td><td className="p-3">{r.origin || '—'}</td><td className="p-3">{r.destination || '—'}</td><td className="p-3">{r.trucks ? r.trucks.toLocaleString() : '—'}</td><td className="p-3">{r.warehouseSqft ? r.warehouseSqft.toLocaleString() : '—'}</td>
        </tr>)}</tbody></table>
    </CardContent></Card>
  </div>;
}

function Vetting({ agents, busy, post }: { agents: Agent[]; busy: boolean; post: (b: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [filter, setFilter] = useState('pending');
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const shown = agents.filter(a => filter === 'all' || a.status === filter).sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
  return <div className="space-y-3">
    <select className="border rounded-lg p-2 bg-white text-sm" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Show"><option value="pending">Waiting for review</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="rejected">Not approved</option><option value="all">All</option></select>
    {!shown.length && <p className="text-muted-foreground">Nobody here.</p>}
    {shown.map(a => {
      const done = Object.keys(VETTING_CHECKS).filter(k => a.vetting?.[k as VettingKey]).length, total = Object.keys(VETTING_CHECKS).length;
      return <Card key={a.uid} className="bg-white"><CardContent className="p-0">
        <button className="w-full text-left p-4 flex flex-wrap justify-between gap-2" onClick={() => { setOpen(open === a.uid ? null : a.uid); setNote(a.reviewNote || ''); }} aria-expanded={open === a.uid}>
          <div><p className="font-bold">{a.companyName}</p><p className="text-xs text-muted-foreground">{a.city}, {regionName(a.region)} · {a.trucks} trucks · serves {a.serviceRegions?.length || 0} areas · applied {a.appliedAt ? new Date(a.appliedAt).toLocaleDateString() : '—'}</p></div>
          <div className="flex gap-2 items-center"><Badge variant="outline">{a.status}</Badge><span className="text-xs">{done}/{total} checks</span></div>
        </button>
        {open === a.uid && <div className="border-t p-4 grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <p><b>Contact:</b> {a.contactName} · <a className="underline" href={`tel:${a.phone}`}>{a.phone}</a> · <a className="underline" href={`mailto:${a.email}`}>{a.email}</a></p>
            {a.website && <p><b>Website:</b> <a className="underline" href={/^https?:/.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer noopener">{a.website}</a></p>}
            <p><b>Address:</b> {a.address}, {a.city}, {regionName(a.region)} {a.postalCode}</p>
            <p><b>Authority:</b> USDOT {a.usdot || '—'} · MC {a.mcNumber || '—'}{a.otherAuthority ? ` · ${a.otherAuthority}` : ''} {a.usdot && <a className="underline ml-1" target="_blank" rel="noreferrer noopener" href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${encodeURIComponent(a.usdot)}`}>Check FMCSA</a>}</p>
            <p><b>Insurance:</b> {a.insuranceCarrier} · cargo ${Number(a.cargoCoverageUsd || 0).toLocaleString()}</p>
            <p><b>Fleet:</b> {a.trucks} trucks, {a.tractors} tractor-trailers · {Number(a.warehouseSqft || 0).toLocaleString()} sq ft warehouse · {a.employees} staff · {a.yearsInBusiness} years</p>
            <p><b>Roles:</b> {a.roles.map(r => AGENT_ROLES[r as AgentRole] || r).join(', ')}</p>
            <p><b>Services:</b> {(a.services || []).join(', ')}</p>
            <p><b>Serves:</b> {a.serviceRegions.map(regionName).join(', ')}</p>
            {a.about && <p className="whitespace-pre-line"><b>About:</b> {a.about}</p>}
            <p className="text-xs text-muted-foreground">Agreement {a.agreementVersion} accepted {a.agreementAcceptedAt ? new Date(a.agreementAcceptedAt).toLocaleString() : ''}</p>
          </div>
          <div className="space-y-3">
            <p className="font-bold">Vetting checklist</p>
            {(Object.keys(VETTING_CHECKS) as VettingKey[]).map(k => <label key={k} className="flex items-start gap-2"><input type="checkbox" className="mt-1" disabled={busy} checked={!!a.vetting?.[k]} onChange={e => void post({ action: 'vetting', uid: a.uid, key: k, done: e.target.checked })} />{VETTING_CHECKS[k]}</label>)}
            <Textarea rows={2} placeholder="Note to the agent (included in the status email)" value={note} onChange={e => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || done < total || a.status === 'approved'} onClick={() => void post({ action: 'review', uid: a.uid, status: 'approved', note }, `${a.companyName} approved.`)}>Approve</Button>
              {a.status === 'approved' && <Button variant="outline" disabled={busy} onClick={() => void post({ action: 'review', uid: a.uid, status: 'suspended', note }, `${a.companyName} suspended.`)}>Suspend</Button>}
              {a.status !== 'approved' && a.status !== 'rejected' && <Button variant="outline" disabled={busy} onClick={() => void post({ action: 'review', uid: a.uid, status: 'rejected', note }, `${a.companyName} not approved.`)}>Don’t approve</Button>}
              {a.status !== 'pending' && <Button variant="ghost" disabled={busy} onClick={() => void post({ action: 'review', uid: a.uid, status: 'pending', note }, `${a.companyName} moved back to review.`)}>Back to review</Button>}
            </div>
            {done < total && <p className="text-xs text-muted-foreground">Approve unlocks when every check is ticked.</p>}
          </div>
        </div>}
      </CardContent></Card>;
    })}
  </div>;
}

function Recruiting({ prospects, busy, post }: { prospects: Prospect[]; busy: boolean; post: (b: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const empty = { company: '', city: '', region: '', contact: '', phone: '', email: '', website: '', notes: '' };
  const [f, setF] = useState(empty);
  const today = new Date().toISOString().slice(0, 10);
  const byStage = useMemo(() => PROSPECT_STAGES.map(s => ({ stage: s, list: prospects.filter(p => p.stage === s).sort((a, b) => (a.nextFollowUp || '9').localeCompare(b.nextFollowUp || '9')) })), [prospects]);
  const due = prospects.filter(p => p.nextFollowUp && p.nextFollowUp <= today && !['joined', 'declined'].includes(p.stage));
  return <div className="space-y-6">
    <Card className="bg-white"><CardContent className="p-4 space-y-3">
      <p className="font-bold">Add a company to recruit</p>
      <form className="grid sm:grid-cols-4 gap-2" onSubmit={async e => { e.preventDefault(); if (await post({ action: 'prospect-add', ...f }, `${f.company} added.`)) setF(empty); }}>
        <Input required placeholder="Company" value={f.company} onChange={e => setF({ ...f, company: e.target.value })} />
        <Input placeholder="City" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} />
        <select className="border rounded-md px-2 bg-white text-sm h-10" value={f.region} onChange={e => setF({ ...f, region: e.target.value })} aria-label="State or province"><option value="">State / province</option>{REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
        <Input placeholder="Contact name" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} />
        <Input placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        <Input placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Website" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
        <Button type="submit" disabled={busy}>Add</Button>
      </form>
      <p className="text-xs text-muted-foreground">Send interested companies to wontstopmoving.com/agents to apply.</p>
    </CardContent></Card>
    {due.length > 0 && <p className="text-sm font-bold text-amber-800">{due.length} follow-up{due.length === 1 ? '' : 's'} due today or overdue.</p>}
    <div className="grid md:grid-cols-3 gap-4">
      {byStage.map(({ stage, list }) => <div key={stage} className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{STAGE_LABEL[stage]} ({list.length})</p>
        {list.map(p => <ProspectCard key={p.id} p={p} busy={busy} post={post} overdue={!!p.nextFollowUp && p.nextFollowUp <= today && !['joined', 'declined'].includes(p.stage)} />)}
      </div>)}
    </div>
  </div>;
}

function ProspectCard({ p, busy, post, overdue }: { p: Prospect; busy: boolean; post: (b: Record<string, unknown>, ok?: string) => Promise<boolean>; overdue: boolean }) {
  const [notes, setNotes] = useState(p.notes || '');
  return <Card className={`bg-white ${overdue ? 'ring-2 ring-amber-400' : ''}`}><CardContent className="p-3 space-y-2 text-sm">
    <p className="font-bold">{p.company}</p>
    <p className="text-xs text-muted-foreground">{[p.city, regionName(p.region)].filter(x => x && x !== '—').join(', ')}{p.contact ? ` · ${p.contact}` : ''}</p>
    {(p.phone || p.email) && <p className="text-xs">{p.phone && <a className="underline" href={`tel:${p.phone}`}>{p.phone}</a>} {p.email && <a className="underline" href={`mailto:${p.email}`}>{p.email}</a>}</p>}
    <select className="border rounded p-1 w-full bg-white" value={p.stage} disabled={busy} onChange={e => void post({ action: 'prospect-update', id: p.id, stage: e.target.value })} aria-label="Stage">{PROSPECT_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
    <label className="text-xs flex items-center gap-2">Follow up <input type="date" className="border rounded p-1" defaultValue={p.nextFollowUp} onBlur={e => { if (e.target.value !== p.nextFollowUp) void post({ action: 'prospect-update', id: p.id, nextFollowUp: e.target.value }); }} /></label>
    <Textarea rows={2} value={notes} placeholder="Notes" onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== p.notes) void post({ action: 'prospect-update', id: p.id, notes }); }} />
    <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => { if (confirm(`Remove ${p.company}?`)) void post({ action: 'prospect-delete', id: p.id }); }}>Remove</button>
  </CardContent></Card>;
}

function Handoffs({ shipments, agents, busy, post }: { shipments: Shipment[]; agents: Agent[]; busy: boolean; post: (b: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  if (!agents.length) return <p className="text-muted-foreground">Approve agents first, then assign them to upcoming moves here.</p>;
  if (!shipments.length) return <p className="text-muted-foreground">No upcoming moves to assign.</p>;
  const name = (uid: string) => agents.find(a => a.uid === uid)?.companyName || 'Agent';
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">For a long-distance move: an origin agent packs and loads, a hauler drives it, and a destination agent delivers. Agents accept or decline in their dashboard; customer contact details are shared only after they accept.</p>
    {shipments.map(s => <Card key={s.id} className="bg-white"><CardContent className="p-4 space-y-3 text-sm">
      <div><p className="font-bold">{s.moveDate || 'No date'} · {s.status}</p><p className="text-muted-foreground">{s.pickupAddress || '—'} → {s.dropoffAddress || '—'}</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {(Object.keys(AGENT_ROLES) as AgentRole[]).map(role => {
          const current = s.agentAssignments[role] || '';
          return <label key={role} className="space-y-1"><span className="text-xs font-medium">{AGENT_ROLES[role]}</span>
            <select className="border rounded p-1.5 w-full bg-white" disabled={busy} value={current} onChange={e => void post({ action: 'assign', jobId: s.id, role, agentUid: e.target.value || null }, e.target.value ? `${name(e.target.value)} assigned.` : 'Assignment removed.')}>
              <option value="">Not assigned</option>{agents.map(a => <option key={a.uid} value={a.uid}>{a.companyName} ({a.city}, {regionName(a.region)})</option>)}
            </select>
            {current && <span className="text-xs text-muted-foreground block">{s.agentResponses[current] === 'accepted' ? 'Accepted' : s.agentResponses[current] === 'declined' ? 'Declined: reassign' : 'Waiting for reply'}</span>}
          </label>;
        })}
      </div>
    </CardContent></Card>)}
  </div>;
}

export default function AdminAgentsPage() { return <EmployeeLayout isAdmin><AgentNetwork /></EmployeeLayout>; }
