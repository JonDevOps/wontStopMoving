import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { actorFor, assigneeInfo, postUpdate, setAssignment } from '@/lib/server/assignments';
import { AGENT_JOB_ROLES, cleanLocation, STAGES, teamFromJob, type AgentJobRole, type AssigneeKind, type Stage } from '@/lib/job-activity';

/**
 * A move's team and activity log.
 * GET: the team (with when each person was assigned and their latest update)
 * and the timeline. Admins also get the people they can assign.
 * POST { action: 'assign' | 'unassign' } (admins) or { action: 'update' }
 * (anyone on the team, or an admin): stage, note and optional location.
 */
const iso = (v: any) => v?.toDate?.().toISOString() || null;
const KINDS: AssigneeKind[] = ['provider', 'employee', 'agent'];

async function load(req: Request, params: Promise<{ id: string }>) {
  const { user, role } = await requireRole(req, ['admin', 'employee', 'provider', 'agent']);
  const { id } = await params;
  if (!isId(id)) throw new HttpError(404, 'Move not found.');
  const job = (await adminDb().doc(`jobs/${id}`).get()).data();
  if (!job) throw new HttpError(404, 'Move not found.');
  const member = teamFromJob(job).find(m => m.id === user.uid);
  if (role !== 'admin' && !member) throw new HttpError(403, 'Only admins and people assigned to this move can see its team.');
  return { user, role, id, job, member };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role, id, job } = await load(req, params);
    const db = adminDb();
    const activitySnap = await db.doc(`jobs/${id}`).collection('activity').orderBy('at', 'desc').limit(200).get();
    const activity = activitySnap.docs.map(d => ({ id: d.id, ...d.data(), at: iso(d.data().at) })) as any[];
    const team = await Promise.all(teamFromJob(job).map(async m => {
      const info = await assigneeInfo(m.kind, m.id);
      const assigned = activity.find(a => a.type === 'assigned' && a.assigneeId === m.id && (m.kind !== 'agent' || a.agentRole === m.agentRole));
      const latest = activity.find(a => a.type === 'update' && a.byUid === m.id);
      return {
        ...m, name: info.name, base: info.base, assignedAt: assigned?.at || null, assignedBy: assigned?.by || null, assignNote: assigned?.note || '',
        response: m.kind === 'agent' ? job.agentResponses?.[m.id] || 'pending' : null,
        latest: latest ? { stage: latest.stage, note: latest.note, at: latest.at, location: latest.location || null } : null,
      };
    }));

    let options: Record<AssigneeKind, { id: string; name: string; base: string }[]> | undefined;
    if (role === 'admin') {
      const [providers, employees, agents] = await Promise.all([
        db.collection('providers').where('status', '==', 'approved').limit(1000).get(),
        db.collection('users').where('role', '==', 'employee').limit(1000).get(),
        db.collection('agents').where('status', '==', 'approved').limit(1000).get(),
      ]);
      options = {
        provider: providers.docs.map(d => ({ id: d.id, name: d.data().businessName || d.data().name || 'Provider', base: [d.data().city, d.data().state].filter(Boolean).join(', ') })),
        employee: employees.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email || 'Employee', base: d.data().state || '' })),
        agent: agents.docs.map(d => ({ id: d.id, name: d.data().companyName || 'Agent', base: [d.data().city, d.data().region].filter(Boolean).join(', ') })),
      };
    }
    return NextResponse.json({ team, activity, options, status: job.status || '' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, id, member } = await load(req, params);
    const body = await readJson(req);
    const actor = await actorFor(user.uid, role, user.email);

    if (body.action === 'assign' || body.action === 'unassign') {
      if (role !== 'admin') throw new HttpError(403, 'Only admins can change who is assigned.');
      const kind = KINDS.find(k => k === body.kind);
      if (!kind || !isId(body.assigneeId)) throw new HttpError(400, 'Choose who to assign.');
      const agentRole = kind === 'agent' ? (Object.keys(AGENT_JOB_ROLES).find(r => r === body.agentRole) as AgentJobRole | undefined) : undefined;
      const changed = await setAssignment({ jobId: id, kind, assigneeId: body.assigneeId, agentRole, remove: body.action === 'unassign', note: typeof body.note === 'string' ? body.note : '', actor });
      return NextResponse.json({ changed });
    }

    if (body.action === 'update') {
      const stage = (Object.keys(STAGES).find(s => s === body.stage) || 'note') as Stage;
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
      if (stage === 'note' && note.length < 2) throw new HttpError(400, 'Write a note or choose a stage.');
      await postUpdate(id, actor, member?.kind || null, { stage, note, location: cleanLocation(body.location) });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    throw new HttpError(400, 'Unknown action.');
  } catch (error) { return errorResponse(error); }
}
