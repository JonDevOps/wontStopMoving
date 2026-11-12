'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ProviderLayout } from '@/components/layout/provider-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { BACKGROUND_STATUSES, type Issue, type MoverProfile } from '@/lib/mover-profile';
import { useToast } from '@/hooks/use-toast';

type Data = { profile: MoverProfile; needsDot: boolean; stripeReady: boolean; issues: Issue[] };

export default function ProviderCredentialsPage() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fill = (d: Data) => {
    setData(d);
    const p = d.profile;
    setForm({ usdot: p.usdot, mcNumber: p.mcNumber, stateLicense: p.stateLicense, insuranceCarrier: p.insuranceCarrier, policyNumber: p.policyNumber, insuranceExpires: p.insuranceExpires, cargoCoverage: p.cargoCoverage?.toString() || '', liabilityCoverage: p.liabilityCoverage?.toString() || '' });
  };
  const load = useCallback(() => { apiFetch<Data>(auth, '/api/provider/credentials').then(fill).catch(() => {}); }, [auth]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { fill(await apiFetch<Data>(auth, '/api/provider/credentials', { ...form, backgroundConsent: consent })); setConsent(false); toast({ title: 'Profile saved' }); }
    catch (err) { toast({ variant: 'destructive', title: 'Couldn’t save', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(false); }
  };
  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><Label htmlFor={`cr-${k}`}>{label}</Label><Input id={`cr-${k}`} value={form[k] || ''} onChange={set(k)} {...props} /></div>
  );

  return (
    <ProviderLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tight">Credentials</h1>
          <p className="text-muted-foreground">Keep your license, insurance and background check current so you keep getting jobs.</p>
        </div>
        {data && (data.issues.length ? (
          <Card className="border-amber-300 bg-amber-50"><CardContent className="p-4 space-y-1">
            {data.issues.map(i => <p key={i.field + i.message} className="text-sm flex items-start gap-2"><AlertTriangle className={`h-4 w-4 mt-0.5 ${i.blocking ? 'text-red-600' : 'text-amber-600'}`} />{i.message}{i.blocking ? ' (needed for new jobs)' : ''}</p>)}
          </CardContent></Card>
        ) : <p className="text-green-700 font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> You’re all set.</p>)}

        <form onSubmit={save} className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-lg">License</CardTitle>
            <CardDescription>{data?.needsDot ? 'You told us you run a DOT-registered vehicle, so your USDOT number is required.' : 'Add your USDOT number if you have one.'} We check it with FMCSA when it changes.</CardDescription></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3">
              {field('usdot', 'USDOT number', { inputMode: 'numeric' })}
              {field('mcNumber', 'MC number (if any)', { inputMode: 'numeric' })}
              {field('stateLicense', 'State mover permit (e.g. CAL-T)')}
              {data?.profile.fmcsa && <p className="sm:col-span-3 text-xs text-muted-foreground">FMCSA check {new Date(data.profile.fmcsa.checkedAt).toLocaleDateString()}: {data.profile.fmcsa.activeAuthority ? 'active authority' : 'no active authority'} · {data.profile.fmcsa.hhgAuthority ? 'household goods' : 'no household goods authority'} · {data.profile.fmcsa.insuranceOnFile ? 'insurance on file' : 'no insurance on file'}</p>}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-lg">Insurance</CardTitle><CardDescription>We remind you 30 days before it expires.</CardDescription></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {field('insuranceCarrier', 'Insurance company')}
              {field('policyNumber', 'Policy number')}
              {field('insuranceExpires', 'Expires', { type: 'date' })}
              {field('cargoCoverage', 'Cargo coverage ($)', { inputMode: 'numeric' })}
              {field('liabilityCoverage', 'Liability coverage ($)', { inputMode: 'numeric' })}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /> Background check</CardTitle>
            <CardDescription>Status: <b>{data ? BACKGROUND_STATUSES[data.profile.backgroundStatus] : '…'}</b></CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {data?.profile.backgroundStatus === 'not-started' ? (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
                  <span>I authorize Wont Stop Moving and its screening provider to obtain a consumer report (background check) about me for working on the platform. I understand I will receive a separate written disclosure and a summary of my rights under the Fair Credit Reporting Act from the screening provider before the report is run.</span></label>
              ) : <p className="text-sm text-muted-foreground">{data?.profile.backgroundConsentAt ? `Consent given ${new Date(data.profile.backgroundConsentAt).toLocaleDateString()}.` : ''} We’ll email you if anything is needed.</p>}
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl"><CardContent className="p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
            <span>Payouts: {data?.stripeReady ? <b className="text-green-700">bank account connected</b> : <b className="text-red-600">not set up yet</b>}</span>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/provider/earnings">Payout settings</Link></Button>
          </CardContent></Card>
          <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? 'Saving…' : 'Save credentials'}</Button>
        </form>
      </div>
    </ProviderLayout>
  );
}
