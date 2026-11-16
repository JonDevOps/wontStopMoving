'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
type Report = { smsConfigured: boolean; payouts: string[]; refunds: string[]; texts: {jobId: string; status: string}[]; operations: {id: string; status: string}[] };
export default function MoverPayments() {
  const auth = useAuth(), [data, setData] = useState<Report | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await apiFetch<Report>(auth, '/api/admin/mover-payments')); } catch (e) { setMessage(e instanceof Error ? e.message : 'Report unavailable.'); } }, [auth]);
  useEffect(() => { load(); }, [load]);
  async function retry(jobId: string, action: string) { setBusy(true); try { await apiFetch(auth, '/api/admin/mover-payments', {jobId,action}); await load(); setMessage('Recovery checked. Unresolved transfers or refunds remain listed.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Recovery unavailable.'); } finally { setBusy(false); } }
  return <EmployeeLayout><div className="space-y-6"><h1 className="text-3xl font-bold">Mover payment follow-up</h1><p>Original-method review refunds and provider transfers that need attention. Repeated recovery uses the same payment request. Ambiguous requests older than 23 hours require checking Stripe before any manual action.</p>{message && <p role="status">{message}</p>}{data && <><p>Payment-code texts: {data.smsConfigured ? 'service configured' : 'waiting for messaging-service setup'}</p>{(['payouts','refunds'] as const).map(kind => <section key={kind} className="space-y-3"><h2 className="text-xl font-bold">{kind}</h2>{!data[kind].length ? <p>No queued follow-up.</p> : data[kind].map(id => <div key={id} className="border bg-white rounded-xl p-4 flex flex-wrap gap-4"><Link className="underline break-all" href={`/dashboard/admin/jobs/${id}`}>{id}</Link><Button disabled={busy} onClick={() => retry(id,kind === 'payouts' ? 'payout' : 'refund')}>Check recovery</Button></div>)}</section>)}<section><h2 className="text-xl font-bold">Text delivery follow-up</h2>{data.texts.map((item,index) => <p key={index}>{item.jobId}: {item.status}</p>)}</section><section><h2 className="text-xl font-bold">Unresolved money requests</h2>{data.operations.map(item => <p key={item.id} className="break-all">{item.id}: {item.status}</p>)}</section></>}</div></EmployeeLayout>;
}
