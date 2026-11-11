import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { actorFor, setAssignment } from '@/lib/server/assignments';
import { vetAgent } from '@/lib/server/network-monitor';
import { loadState } from '@/lib/server/registry-store';
import { yearsInBusiness } from '@/lib/registry';
import { AGENT_ROLES, networkCoverage, PROSPECT_STAGES, VETTING_CHECKS, type AgentRole, type VettingKey, REGION_BY_CODE } from '@/lib/agents';

/** Agent network admin: vetting, coverage, recruiting pipeline and shipment handoffs. */
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [agents, prospects, jobs, alerts] = await Promise.all([
      db.collection('agents').limit(2000).get(),
      db.collection('agentProspects').limit(2000).get(),
      db.collection('jobs').orderBy('createdAt', 'desc').limit(150).get(),
      db.collection('networkAlerts').where('resolved', '==', false).limit(200).get(),
    ]);
    const list = agents.docs.map(d => {
      const a = d.data();
      return { ...a, uid: d.id, vetting: a.vetting || {}, appliedAt: iso(a.appliedAt), approvedAt: iso(a.approvedAt), reviewedAt: iso(a.reviewedAt), agreementAcceptedAt: iso(a.agreementAcceptedAt), updatedAt: iso(a.updatedAt) };
    }) as any[];
    const approved = list.filter(a => a.status === 'approved');
    const totals = approved.reduce((t, a) => ({ trucks: t.trucks + (a.trucks || 0), tractors: t.tractors + (a.tractors || 0), warehouseSqft: t.warehouseSqft + (a.warehouseSqft || 0), employees: t.employees + (a.employees || 0) }), { trucks: 0, tractors: 0, warehouseSqft: 0, employees: 0 });
    const coverage = networkCoverage(list);
    const shipments = jobs.docs.map(d => ({ id: d.id, ...d.data() } as any))
      .filter(j => j.status !== 'completed' && j.status !== 'cancelled')
      .map(j => ({ id: j.id, moveDate: j.moveDate || '', pickupAddress: j.pickupAddress || '', dropoffAddress: j.dropoffAddress || '', state: j.state || '', status: j.status || 'scheduled', agentAssignments: j.agentAssignments || {}, agentResponses: j.agentResponses || {} }));
    return NextResponse.json({
      agents: list, totals: { ...totals, approved: approved.length, pending: list.filter(a => a.status === 'pending').length, covered: coverage.covered },
      alerts: alerts.docs.map(d => ({ id: d.id, ...d.data(), at: iso(d.data().at) })),
      coverage: coverage.regions, prospects: prospects.docs.map(d => ({ id: d.id, ...d.data(), createdAt: iso(d.data().createdAt), updatedAt: iso(d.data().updatedAt) })), shipments,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb(), now = FieldValue.serverTimestamp();

    switch (body.action) {
      case 'vetting': {
        if (!isId(body.uid) || typeof body.key !== 'string' || !(body.key in VETTING_CHECKS)) throw new HttpError(400, 'Choose a check.');
        await db.doc(`agents/${body.uid}`).update({ [`vetting.${body.key as VettingKey}`]: body.done === true, updatedAt: now });
        return NextResponse.json({ ok: true });
      }
      case 'review': {
        if (!isId(body.uid)) throw new HttpError(400, 'Choose an agent.');
        const status = STATUSES.find(s => s === body.status);
        if (!status) throw new HttpError(400, 'Choose a status.');
        const ref = db.doc(`agents/${body.uid}`), a = (await ref.get()).data();
        if (!a) throw new HttpError(404, 'Agent not found.');
        if (status === 'approved' && !Object.keys(VETTING_CHECKS).every(k => a.vetting?.[k] === true)) throw new HttpError(409, 'Finish every vetting check before approving.');
        const note = str(body.note, 1000);
        await ref.update({ status, reviewNote: note || FieldValue.delete(), reviewedBy: user.uid, reviewedAt: now, ...(status === 'approved' && a.status !== 'approved' ? { approvedAt: now } : {}) });
        if (a.email && status !== a.status && status !== 'pending') {
          const text = status === 'approved'
            ? `Hi ${a.contactName || 'there'},\n\nWelcome to the Wont Stop Moving agent network. ${a.companyName} is approved. Sign in to see shipments assigned to you and the network directory of other agents:\nhttps://wontstopmoving.com/login?role=agent\n\nWont Stop Moving`
            : `Hi ${a.contactName || 'there'},\n\nYour Wont Stop Moving agent network status for ${a.companyName} is now: ${status}.${note ? `\n\nNote from our team: ${note}` : ''}\n\nQuestions? Call (415) 214-5474.\n\nWont Stop Moving`;
          try { await enqueueEmail(`agent-status:${body.uid}:${status}:${Date.now()}`, { category: 'agent', referenceId: body.uid, to: a.email, subject: status === 'approved' ? 'You’re approved: Wont Stop Moving agent network' : 'Your agent network status changed', text }); }
          catch (error) { console.error('Agent status email failed', body.uid, error); }
        }
        return NextResponse.json({ ok: true });
      }
      case 'federal-check': {
        if (!isId(body.uid)) throw new HttpError(400, 'Choose an agent.');
        const check = await vetAgent(body.uid);
        if (!check) throw new HttpError(409, 'This agent has no USDOT number to check.');
        return NextResponse.json({ check });
      }
      case 'resolve-alert': {
        if (!isId(body.id)) throw new HttpError(400, 'Choose an alert.');
        await db.doc(`networkAlerts/${body.id}`).update({ resolved: true, resolvedBy: user.uid, resolvedAt: now });
        return NextResponse.json({ ok: true });
      }
      case 'prospect-add-many': {
        const list = (Array.isArray(body.movers) ? body.movers : []).slice(0, 100) as { dot: string; state: string }[];
        const byState = new Map<string, string[]>();
        for (const m of list) if (typeof m?.dot === 'string' && /^\d{1,9}$/.test(m.dot) && /^[A-Z]{2}$/.test(m?.state || '')) byState.set(m.state, [...(byState.get(m.state) || []), m.dot]);
        const existing = new Set((await db.collection('agentProspects').select('dot').get()).docs.map(d => String(d.data().dot || '')));
        let added = 0;
        const batch = db.batch();
        for (const [state, dots] of byState) {
          const rows = new Map((await loadState(state)).map(m => [m.dot, m]));
          for (const dot of dots) {
            const m = rows.get(dot);
            if (!m || existing.has(dot)) continue;
            const years = yearsInBusiness(m);
            batch.set(db.collection('agentProspects').doc(), {
              company: (m.dba || m.name).slice(0, 160), city: m.city, region: REGION_BY_CODE.has(`US-${state}`) ? `US-${state}` : REGION_BY_CODE.has(`CA-${state}`) ? `CA-${state}` : '', contact: m.officer, phone: m.phone, email: m.email, website: m.site,
              notes: `From the mover registry: USDOT ${m.dot}${m.mc ? `, ${m.mc}` : ''}; ${m.units} trucks, ${m.drivers} drivers, ${years} years${m.hhgAuth ? ', household-goods authority' : ''}.${typeof body.note === 'string' && body.note ? ` ${body.note.slice(0, 300)}` : ''}`,
              dot, source: typeof body.source === 'string' ? body.source.slice(0, 40) : 'registry', stage: 'prospect', nextFollowUp: '', createdBy: user.uid, createdAt: now, updatedAt: now,
            });
            added++;
          }
        }
        if (added) await batch.commit();
        return NextResponse.json({ added, skipped: list.length - added });
      }
      case 'prospect-add': {
        const company = str(body.company, 160);
        if (company.length < 2) throw new HttpError(400, 'Enter the company name.');
        const region = str(body.region, 10);
        const ref = await db.collection('agentProspects').add({
          company, city: str(body.city, 80), region: REGION_BY_CODE.has(region) ? region : '', contact: str(body.contact, 120), phone: str(body.phone, 30), email: str(body.email, 200),
          website: str(body.website, 300), notes: str(body.notes, 3000), stage: 'prospect', nextFollowUp: str(body.nextFollowUp, 10), createdBy: user.uid, createdAt: now, updatedAt: now,
        });
        return NextResponse.json({ id: ref.id }, { status: 201 });
      }
      case 'prospect-update': {
        if (!isId(body.id)) throw new HttpError(400, 'Choose a prospect.');
        const patch: Record<string, unknown> = { updatedAt: now };
        if (body.stage !== undefined) { const stage = PROSPECT_STAGES.find(s => s === body.stage); if (!stage) throw new HttpError(400, 'Choose a stage.'); patch.stage = stage; }
        if (typeof body.notes === 'string') patch.notes = str(body.notes, 3000);
        if (typeof body.nextFollowUp === 'string') patch.nextFollowUp = /^\d{4}-\d{2}-\d{2}$/.test(body.nextFollowUp) ? body.nextFollowUp : '';
        await db.doc(`agentProspects/${body.id}`).update(patch);
        return NextResponse.json({ ok: true });
      }
      case 'prospect-delete': {
        if (!isId(body.id)) throw new HttpError(400, 'Choose a prospect.');
        await db.doc(`agentProspects/${body.id}`).delete();
        return NextResponse.json({ ok: true });
      }
      case 'assign': {
        if (!isId(body.jobId)) throw new HttpError(400, 'Choose a job.');
        const role = body.role as AgentRole;
        if (!(role in AGENT_ROLES)) throw new HttpError(400, 'Choose the agent’s role.');
        const actor = await actorFor(user.uid, 'admin', user.email);
        if (body.agentUid === null || body.agentUid === '') {
          const current = (await db.doc(`jobs/${body.jobId}`).get()).data()?.agentAssignments?.[role];
          if (current) await setAssignment({ jobId: body.jobId, kind: 'agent', assigneeId: current, agentRole: role, remove: true, actor });
        } else {
          if (!isId(body.agentUid)) throw new HttpError(400, 'Choose an agent.');
          await setAssignment({ jobId: body.jobId, kind: 'agent', assigneeId: body.agentUid, agentRole: role, actor });
        }
        return NextResponse.json({ ok: true });
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (error) { return errorResponse(error); }
}
