import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { AGENT_ROLES, AGENT_SERVICES, type AgentRole, REGION_BY_CODE } from '@/lib/agents';

/** The agent's own company record, their shipments, and (once approved) the network directory. */
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const int = (v: unknown, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : undefined; };

export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['agent', 'admin']);
    const db = adminDb();
    const agent = (await db.doc(`agents/${user.uid}`).get()).data();
    if (!agent) return NextResponse.json({ agent: null, shipments: [], directory: [] });
    const approved = agent.status === 'approved';
    const [jobs, network] = await Promise.all([
      db.collection('jobs').where('agentIds', 'array-contains', user.uid).limit(100).get(),
      approved ? db.collection('agents').where('status', '==', 'approved').limit(1000).get() : null,
    ]);
    const shipments = await Promise.all(jobs.docs.map(async d => {
      const j = d.data();
      const roles = Object.entries(j.agentAssignments || {}).filter(([, uid]) => uid === user.uid).map(([r]) => r);
      const response = j.agentResponses?.[user.uid] || 'pending';
      // Customer contact details only once the agent has accepted the shipment.
      const customer = response === 'accepted' && j.customerId ? (await db.doc(`users/${j.customerId}`).get()).data() : null;
      return {
        jobId: d.id, roles, response, status: j.status || 'scheduled', moveDate: j.moveDate || '', pickupAddress: j.pickupAddress || '', dropoffAddress: j.dropoffAddress || '',
        moveSize: j.moveSize || '', specialItems: j.specialItems || '', customer: customer ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '' } : null,
      };
    }));
    shipments.sort((a, b) => (a.moveDate || '9').localeCompare(b.moveDate || '9'));
    const directory = (network?.docs || []).filter(d => d.id !== user.uid).map(d => {
      const a = d.data();
      return { uid: d.id, companyName: a.companyName, city: a.city, region: a.region, country: a.country, phone: a.phone, email: a.email, roles: a.roles || [], serviceRegions: a.serviceRegions || [], trucks: a.trucks || 0, warehouseSqft: a.warehouseSqft || 0 };
    });
    const { vetting, ...mine } = agent;
    return NextResponse.json({
      agent: { ...mine, vettingDone: Object.values(vetting || {}).filter(Boolean).length, appliedAt: iso(agent.appliedAt), approvedAt: iso(agent.approvedAt), agreementAcceptedAt: iso(agent.agreementAcceptedAt), updatedAt: iso(agent.updatedAt), reviewedAt: iso(agent.reviewedAt) },
      shipments, directory,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['agent']);
    const body = await readJson(req);
    const db = adminDb(), ref = db.doc(`agents/${user.uid}`);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Apply to the agent network first.');

    if (body.action === 'update') {
      const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      for (const [k, max] of [['trucks', 1e5], ['tractors', 1e5], ['warehouseSqft', 1e8], ['employees', 1e6], ['availableTrucks', 1e5]] as const) { const v = int(body[k], max); if (v !== undefined) patch[k] = v; }
      if (Array.isArray(body.services)) patch.services = body.services.filter(x => (AGENT_SERVICES as readonly string[]).includes(x as string));
      if (Array.isArray(body.roles)) { const roles = body.roles.filter((x): x is AgentRole => typeof x === 'string' && x in AGENT_ROLES); if (!roles.length) throw new HttpError(400, 'Keep at least one way of working with the network.'); patch.roles = roles; }
      if (Array.isArray(body.serviceRegions)) { const regions = body.serviceRegions.filter(x => typeof x === 'string' && REGION_BY_CODE.has(x)).slice(0, 100); if (!regions.length) throw new HttpError(400, 'Keep at least one state or province.'); patch.serviceRegions = regions; }
      for (const [k, n] of [['phone', 30], ['website', 300], ['about', 3000], ['capacityNote', 500]] as const) if (typeof body[k] === 'string') patch[k] = (body[k] as string).trim().slice(0, n);
      await ref.update(patch);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'respond') {
      if (!isId(body.jobId)) throw new HttpError(400, 'Choose a shipment.');
      const response = body.response === 'declined' ? 'declined' : 'accepted';
      const jobRef = db.doc(`jobs/${body.jobId}`);
      await db.runTransaction(async tx => {
        const j = (await tx.get(jobRef)).data();
        if (!j || !Array.isArray(j.agentIds) || !j.agentIds.includes(user.uid)) throw new HttpError(404, 'Shipment not found.');
        tx.update(jobRef, { [`agentResponses.${user.uid}`]: response, [`agentRespondedAt.${user.uid}`]: FieldValue.serverTimestamp() });
      });
      return NextResponse.json({ ok: true, response });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
