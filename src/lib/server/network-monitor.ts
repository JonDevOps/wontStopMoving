import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { activeInsuranceFor, authorityFor, coverageTotals } from './fmcsa';
import { enqueueEmail } from './notifications';

/**
 * Federal checks for agents (and providers with a USDOT number): operating
 * authority and insurance on file with FMCSA. Run when an agent applies (it
 * ticks the matching vetting boxes) and daily for everyone approved, with an
 * alert when something lapses.
 */
export type FederalCheck = {
  checkedAt: string; dot: string; mc: string; common: boolean; hhg: boolean; broker: boolean; pendingRevocation: boolean;
  liability: number; cargo: number; cancelsSoon: string | null; issues: string[]; ok: boolean;
};

export async function federalCheck(dot: string, opts: { interstate?: boolean } = {}): Promise<FederalCheck> {
  const [auth, policies] = await Promise.all([authorityFor(dot), activeInsuranceFor(dot)]);
  const best = auth.find(a => a.hhg && a.common) || auth.find(a => a.common) || auth[0];
  const cover = coverageTotals(policies);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), today = new Date().toISOString().slice(0, 10);
  const cancelsSoon = policies.filter(p => /BIPD|CARGO/i.test(p.kind) && p.cancels && p.cancels > today && p.cancels <= soon).map(p => p.cancels).sort()[0] || null;
  const issues: string[] = [];
  const needsAuthority = opts.interstate !== false;
  if (needsAuthority && !best?.common) issues.push('No active FMCSA operating authority');
  else if (needsAuthority && !best?.hhg) issues.push('Authority doesn’t include household goods');
  if (best?.pendingRevocation) issues.push('FMCSA revocation pending');
  if (needsAuthority && !cover.liability) issues.push('No liability (BIPD) insurance on file with FMCSA');
  if (needsAuthority && !cover.cargo) issues.push('No cargo insurance on file with FMCSA');
  if (cancelsSoon) issues.push(`Insurance set to cancel on ${cancelsSoon}`);
  return { checkedAt: new Date().toISOString(), dot: String(Number(dot)), mc: best?.mc || '', common: !!best?.common, hhg: !!best?.hhg, broker: auth.some(a => a.broker), pendingRevocation: !!best?.pendingRevocation, liability: cover.liability, cargo: cover.cargo, cancelsSoon, issues, ok: issues.length === 0 };
}

/** Checks an agent and ticks the authority/insurance vetting boxes when FMCSA confirms them. */
export async function vetAgent(uid: string) {
  const ref = adminDb().doc(`agents/${uid}`);
  const a = (await ref.get()).data();
  if (!a?.usdot) return null;
  const check = await federalCheck(a.usdot, { interstate: a.country === 'US' });
  const patch: Record<string, unknown> = { federal: check };
  if (check.common && check.hhg && !check.pendingRevocation) patch['vetting.authority'] = true;
  if (check.liability > 0 && check.cargo > 0) patch['vetting.insurance'] = true;
  await ref.update(patch);
  return check;
}

/** Daily: re-check everyone approved; alert on new problems. */
export async function monitorNetwork() {
  const db = adminDb();
  const [agents, providers] = await Promise.all([
    db.collection('agents').where('status', '==', 'approved').get(),
    db.collection('providers').where('status', '==', 'approved').get(),
  ]);
  const people = [
    ...agents.docs.filter(d => d.data().usdot).map(d => ({ ref: d.ref, kind: 'agent', id: d.id, name: d.data().companyName, dot: String(d.data().usdot), interstate: d.data().country === 'US', prev: d.data().federal as FederalCheck | undefined })),
    ...providers.docs.filter(d => d.data().usdot).map(d => ({ ref: d.ref, kind: 'provider', id: d.id, name: d.data().businessName || 'Provider', dot: String(d.data().usdot), interstate: !!d.data().interstate, prev: d.data().federal as FederalCheck | undefined })),
  ];
  const alerts: { name: string; kind: string; issues: string[] }[] = [];
  for (const p of people) {
    try {
      const check = await federalCheck(p.dot, { interstate: p.interstate });
      const fresh = check.issues.filter(i => !(p.prev?.issues || []).includes(i));
      await p.ref.update({ federal: check });
      if (fresh.length) {
        alerts.push({ name: p.name, kind: p.kind, issues: fresh });
        await db.collection('networkAlerts').add({ kind: p.kind, id: p.id, name: p.name, dot: p.dot, issues: fresh, resolved: false, at: FieldValue.serverTimestamp() });
      }
    } catch (error) { console.error('Federal check failed', p.kind, p.id, error); }
  }
  if (alerts.length) {
    const day = new Date().toISOString().slice(0, 10);
    await enqueueEmail(`network-alerts:${day}`, {
      category: 'agent', referenceId: day, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
      subject: `Network alert: ${alerts.length} partner${alerts.length === 1 ? '' : 's'} with federal compliance problems`,
      text: `FMCSA records changed for:\n\n${alerts.map(a => `${a.name} (${a.kind})\n${a.issues.map(i => `  - ${i}`).join('\n')}`).join('\n\n')}\n\nPause assignments until it's fixed, and ask for updated certificates.\nhttps://wontstopmoving.com/dashboard/admin/agents\n\nWont Stop Moving`,
    });
  }
  return { checked: people.length, alerts: alerts.length };
}
