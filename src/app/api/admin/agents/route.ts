import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { AGENT_ROLES, networkCoverage, PROSPECT_STAGES, VETTING_CHECKS, type AgentRole, type VettingKey, REGION_BY_CODE } from '@/lib/agents';

/** Agent network admin: vetting, coverage, recruiting pipeline and shipment handoffs. */
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [agents, prospects, jobs] = await Promise.all([
      db.collection('agents').limit(2000).get(),
      db.collection('agentProspects').limit(2000).get(),
      db.collection('jobs').orderBy('createdAt', 'desc').limit(150).get(),
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
        const agentUid = body.agentUid === null || body.agentUid === '' ? null : body.agentUid;
        let agent: FirebaseFirestore.DocumentData | undefined;
        if (agentUid !== null) {
          if (!isId(agentUid)) throw new HttpError(400, 'Choose an agent.');
          agent = (await db.doc(`agents/${agentUid}`).get()).data();
          if (agent?.status !== 'approved') throw new HttpError(409, 'Only approved agents can be assigned.');
        }
        const jobRef = db.doc(`jobs/${body.jobId}`);
        await db.runTransaction(async tx => {
          const j = (await tx.get(jobRef)).data();
          if (!j) throw new HttpError(404, 'Job not found.');
          const assignments = { ...(j.agentAssignments || {}) } as Record<string, string>;
          if (agentUid) assignments[role] = agentUid; else delete assignments[role];
          const responses = { ...(j.agentResponses || {}) } as Record<string, string>;
          const ids = [...new Set(Object.values(assignments))];
          for (const id of Object.keys(responses)) if (!ids.includes(id)) delete responses[id];
          if (agentUid && !responses[agentUid]) responses[agentUid] = 'pending';
          tx.update(jobRef, { agentAssignments: assignments, agentIds: ids, agentResponses: responses });
        });
        if (agent?.email) {
          try {
            await enqueueEmail(`agent-shipment:${body.jobId}:${role}:${agentUid}`, {
              category: 'agent', referenceId: String(body.jobId), to: agent.email,
              subject: `New shipment for ${agent.companyName}: ${AGENT_ROLES[role]}`,
              text: `Hi ${agent.contactName || 'there'},\n\nWont Stop Moving assigned ${agent.companyName} a shipment as the ${AGENT_ROLES[role].toLowerCase()}. Please accept or decline it in your agent dashboard:\nhttps://wontstopmoving.com/dashboard/agent\n\nWont Stop Moving`,
            });
          } catch (error) { console.error('Agent shipment email failed', body.jobId, error); }
        }
        return NextResponse.json({ ok: true });
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (error) { return errorResponse(error); }
}
