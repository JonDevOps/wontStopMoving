'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { PublicLayout } from '@/components/layout/public-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GoogleButton } from '@/components/auth/google-button';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { googleErrorMessage, signInWithGooglePopup } from '@/lib/google-sign-in';
import { sendSignupVerification } from '@/lib/email-verification';
import { AGENT_ROLES, AGENT_SERVICES, checkAgentApplication, type AgentRole, COUNTRY_NAMES, REGIONS, type Country } from '@/lib/agents';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,30}$/;
const label = 'text-xs font-bold uppercase tracking-widest text-slate-500';

function AccountStep() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!passwordRegex.test(password)) { setError('Password must be 8-30 characters with an uppercase letter, a lowercase letter, a number and a symbol.'); return; }
    setBusy(true);
    try { const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password); await sendSignupVerification(user); }
    catch (err: any) { setError(err?.code === 'auth/email-already-in-use' ? 'That email already has an account. Sign in instead, then come back to this page.' : 'Could not create the account. Try again.'); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setError(''); setBusy(true);
    try { await signInWithGooglePopup(auth); }
    catch (err) { const m = googleErrorMessage(err); if (m) setError(m); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-black uppercase">Step 1: Your company login</h2><p className="text-muted-foreground text-sm">Use a company email your dispatch team checks.</p></div>
    <GoogleButton onClick={google} disabled={busy} label="Continue with Google" />
    <form onSubmit={create} className="space-y-3">
      <Input type="email" required placeholder="dispatch@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" />
      <Input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} aria-label="Password" />
      <Button type="submit" className="w-full" disabled={busy}>Create account and continue</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive font-medium">{error}</p>}
    <p className="text-sm text-muted-foreground">Already have an agent account? <Link className="underline font-bold" href="/login?role=agent">Sign in</Link></p>
  </div>;
}

function ApplicationStep({ email }: { email: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [f, setF] = useState({
    companyName: '', contactName: '', phone: '', website: '', country: 'US' as Country, address: '', city: '', region: '', postalCode: '',
    usdot: '', mcNumber: '', otherAuthority: '', yearsInBusiness: '', trucks: '', tractors: '', warehouseSqft: '', employees: '',
    insuranceCarrier: '', cargoCoverageUsd: '', about: '',
  });
  const [services, setServices] = useState<string[]>([]);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = <T,>(list: T[], v: T, setList: (l: T[]) => void) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const payload = { ...f, services, roles, serviceRegions: regions, agreementAccepted: agree };
    const checked = checkAgentApplication(payload);
    if (!checked.ok) { setError(checked.error); return; }
    setBusy(true);
    try { await apiFetch(auth, '/api/agents/apply', checked.data); router.push('/dashboard/agent'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not submit the application.'); setBusy(false); }
  };

  return <form onSubmit={submit} className="space-y-8">
    <div><h2 className="text-2xl font-black uppercase">Step 2: Your company</h2><p className="text-muted-foreground text-sm">Signed in as {email}.</p></div>
    <section className="grid sm:grid-cols-2 gap-4">
      <label className="space-y-1"><span className={label}>Company name</span><Input required value={f.companyName} onChange={set('companyName')} /></label>
      <label className="space-y-1"><span className={label}>Contact name</span><Input required value={f.contactName} onChange={set('contactName')} /></label>
      <label className="space-y-1"><span className={label}>Phone</span><Input required value={f.phone} onChange={set('phone')} /></label>
      <label className="space-y-1"><span className={label}>Website</span><Input value={f.website} onChange={set('website')} /></label>
    </section>
    <section className="grid sm:grid-cols-2 gap-4">
      <label className="space-y-1"><span className={label}>Country</span>
        <select className="w-full h-10 border rounded-md px-3 bg-white" value={f.country} onChange={e => setF({ ...f, country: e.target.value as Country, region: '' })}>{(Object.keys(COUNTRY_NAMES) as Country[]).map(c => <option key={c} value={c}>{COUNTRY_NAMES[c]}</option>)}</select></label>
      <label className="space-y-1"><span className={label}>Street address (office or warehouse)</span><Input required value={f.address} onChange={set('address')} /></label>
      <label className="space-y-1"><span className={label}>City</span><Input required value={f.city} onChange={set('city')} /></label>
      <label className="space-y-1"><span className={label}>State / province</span>
        <select required className="w-full h-10 border rounded-md px-3 bg-white" value={f.region} onChange={set('region')}><option value="">Choose…</option>{REGIONS.filter(r => r.country === f.country).map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
      <label className="space-y-1"><span className={label}>ZIP / postal code</span><Input value={f.postalCode} onChange={set('postalCode')} /></label>
      <label className="space-y-1"><span className={label}>Years in business</span><Input inputMode="numeric" value={f.yearsInBusiness} onChange={set('yearsInBusiness')} /></label>
    </section>
    <section className="grid sm:grid-cols-3 gap-4">
      <label className="space-y-1"><span className={label}>USDOT number{f.country === 'US' ? '' : ' (if any)'}</span><Input inputMode="numeric" value={f.usdot} onChange={set('usdot')} /></label>
      <label className="space-y-1"><span className={label}>MC number (interstate)</span><Input inputMode="numeric" value={f.mcNumber} onChange={set('mcNumber')} /></label>
      <label className="space-y-1"><span className={label}>{f.country === 'US' ? 'State authority (optional)' : 'Operating authority / registration'}</span><Input value={f.otherAuthority} onChange={set('otherAuthority')} placeholder={f.country === 'CA' ? 'e.g. NSC number' : f.country === 'MX' ? 'e.g. SICT permit' : 'e.g. CA PUC'} /></label>
    </section>
    <section className="grid sm:grid-cols-4 gap-4">
      <label className="space-y-1"><span className={label}>Moving trucks</span><Input required inputMode="numeric" value={f.trucks} onChange={set('trucks')} /></label>
      <label className="space-y-1"><span className={label}>Tractor-trailers</span><Input inputMode="numeric" value={f.tractors} onChange={set('tractors')} /></label>
      <label className="space-y-1"><span className={label}>Warehouse sq ft</span><Input inputMode="numeric" value={f.warehouseSqft} onChange={set('warehouseSqft')} /></label>
      <label className="space-y-1"><span className={label}>Employees</span><Input inputMode="numeric" value={f.employees} onChange={set('employees')} /></label>
      <label className="space-y-1 sm:col-span-2"><span className={label}>Insurance carrier</span><Input required value={f.insuranceCarrier} onChange={set('insuranceCarrier')} /></label>
      <label className="space-y-1 sm:col-span-2"><span className={label}>Cargo coverage ($)</span><Input inputMode="numeric" value={f.cargoCoverageUsd} onChange={set('cargoCoverageUsd')} /></label>
    </section>
    <fieldset className="space-y-2"><legend className={label}>Services you offer</legend>
      <div className="grid sm:grid-cols-3 gap-2">{AGENT_SERVICES.map(s => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={services.includes(s)} onChange={() => toggle(services, s, setServices)} />{s}</label>)}</div>
    </fieldset>
    <fieldset className="space-y-2"><legend className={label}>How you want to work with the network</legend>
      <div className="grid sm:grid-cols-2 gap-2">{(Object.keys(AGENT_ROLES) as AgentRole[]).map(r => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(roles, r, setRoles)} />{AGENT_ROLES[r]}</label>)}</div>
    </fieldset>
    <fieldset className="space-y-3"><legend className={label}>States and provinces you serve</legend>
      {(Object.keys(COUNTRY_NAMES) as Country[]).map(c => {
        const list = REGIONS.filter(r => r.country === c);
        return <details key={c} open={c === f.country} className="bg-gray-50 rounded-xl p-3">
          <summary className="font-bold cursor-pointer">{COUNTRY_NAMES[c]} ({regions.filter(code => code.startsWith(`${c}-`)).length} chosen)</summary>
          <button type="button" className="text-xs underline my-2" onClick={() => setRegions(list.every(r => regions.includes(r.code)) ? regions.filter(x => !x.startsWith(`${c}-`)) : [...new Set([...regions, ...list.map(r => r.code)])])}>{list.every(r => regions.includes(r.code)) ? 'Clear all' : 'Select all'}</button>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">{list.map(r => <label key={r.code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={regions.includes(r.code)} onChange={() => toggle(regions, r.code, setRegions)} />{r.name}</label>)}</div>
        </details>;
      })}
    </fieldset>
    <label className="space-y-1 block"><span className={label}>About your company</span><Textarea rows={4} value={f.about} onChange={set('about')} placeholder="Specialties, notable clients, van line or association memberships, anything that sets you apart." /></label>
    <section className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
      <p className="font-bold">Agent agreement (summary)</p>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        <li>You are an independent business, responsible for your own crews, vehicles, permits, taxes and insurance.</li>
        <li>You keep your operating authority and insurance active and tell us right away if either lapses.</li>
        <li>You handle every shipment we assign professionally, keep customer information private, and never solicit our customers for work outside the network.</li>
        <li>Either side can end the arrangement in writing; shipments already accepted are completed.</li>
      </ul>
      <label className="flex items-start gap-2 pt-2"><input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />I agree to the agent agreement and the <Link href="/terms" className="underline" target="_blank">Terms of Service</Link>, and I’m authorized to apply for this company.</label>
    </section>
    {error && <p role="alert" className="text-sm text-destructive font-medium">{error}</p>}
    <Button type="submit" size="lg" className="w-full font-black uppercase" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
  </form>;
}

export default function AgentApplyPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [otherRole, setOtherRole] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) { setChecked(true); setOtherRole(null); return; }
    getDoc(doc(firestore, 'users', user.uid)).then(snap => {
      const role = snap.exists() ? snap.data().role : null;
      if (role === 'agent') { router.replace('/dashboard/agent'); return; }
      setOtherRole(role); setChecked(true);
    }).catch(() => setChecked(true));
  }, [user, isUserLoading, firestore, router]);

  return <PublicLayout>
    <div className="min-h-screen bg-gray-50 pt-32 pb-24">
      <div className="container mx-auto px-4 max-w-3xl space-y-6">
        <Link href="/agents" className="text-primary font-bold">← Agent network</Link>
        <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Apply to the <span className="text-accent">Agent Network</span></h1>
        <Card className="border-none shadow-xl rounded-3xl bg-white"><CardContent className="p-6 sm:p-10">
          {!checked ? <p>Loading…</p>
            : !user ? <AccountStep />
            : otherRole ? <p>This sign-in is already a {otherRole} account. To apply for your company, sign out and create an agent account with a different email.</p>
            : <ApplicationStep email={user.email || ''} />}
        </CardContent></Card>
      </div>
    </div>
  </PublicLayout>;
}
