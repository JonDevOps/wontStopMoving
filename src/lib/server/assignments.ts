import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { HttpError } from './auth';
import { enqueueEmail, queueJobEmails } from './notifications';
import { AGENT_JOB_ROLES, type AgentJobRole, type AssigneeKind, type Location, type Stage } from '@/lib/job-activity';

/**
 * Assigning movers (providers), crew (employees) and network agents to a
 * move, with every change logged in jobs/{id}/activity (server-only).
 * Every place that assigns people uses these, so the history is complete.
 */
export type Actor = { uid: string; name: string; role: string };

export async function actorFor(uid: string, role: string, fallbackEmail?: string): Promise<Actor> {
  const p = (await adminDb().doc(`users/${uid}`).get()).data();
  return { uid, role, name: p?.name || p?.email || fallbackEmail || role };
}

/** Display name and home base for someone who can be assigned. */
export async function assigneeInfo(kind: AssigneeKind, id: string): Promise<{ name: string; base: string; email: string; eligible: boolean; reason?: string; raw?: DocumentData }> {
  const db = adminDb();
  if (kind === 'provider') {
    const p = (await db.doc(`providers/${id}`).get()).data();
    if (!p) return { name: 'Unknown provider', base: '', email: '', eligible: false, reason: 'Provider not found.' };
    return { name: p.businessName || p.name || 'Provider', base: [p.city, p.state].filter(Boolean).join(', '), email: p.email || '', eligible: p.status === 'approved', reason: 'Only approved providers can be assigned.' };
  }
  if (kind === 'agent') {
    const a = (await db.doc(`agents/${id}`).get()).data();
    if (!a) return { name: 'Unknown agent', base: '', email: '', eligible: false, reason: 'Agent not found.' };
    return { name: a.companyName || 'Agent', base: [a.city, a.region].filter(Boolean).join(', '), email: a.email || '', eligible: a.status === 'approved', reason: 'Only approved agents can be assigned.', raw: a };
  }
  const u = (await db.doc(`users/${id}`).get()).data();
  if (!u) return { name: 'Unknown employee', base: '', email: '', eligible: false, reason: 'Employee not found.' };
  return { name: u.name || u.email || 'Employee', base: u.state || '', email: u.email || '', eligible: u.role === 'employee', reason: 'Only employees can be dispatched as crew.' };
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Assigns (or, with remove, unassigns) one person. Returns false if nothing changed. */
export async function setAssignment(opts: { jobId: string; kind: AssigneeKind; assigneeId: string; agentRole?: AgentJobRole; remove?: boolean; note?: string; actor: Actor }): Promise<boolean> {
  const { jobId, kind, assigneeId, agentRole, remove, actor } = opts;
  if (kind === 'agent' && (!agentRole || !(agentRole in AGENT_JOB_ROLES))) throw new HttpError(400, 'Choose the agent’s role on this move.');
  const info = await assigneeInfo(kind, assigneeId);
  if (!remove && !info.eligible) throw new HttpError(409, info.reason || 'That person can’t be assigned.');
  const db = adminDb(), jobRef = db.doc(`jobs/${jobId}`);
  const note = clip(opts.note, 1000);

  const changed = await db.runTransaction(async tx => {
    const job = (await tx.get(jobRef)).data();
    if (!job) throw new HttpError(404, 'Move not found.');
    if (!remove && ['completed', 'cancelled'].includes(job.status)) throw new HttpError(409, `This move is ${job.status}.`);
    const patch: Record<string, any> = {};
    if (kind === 'agent') {
      const assignments = { ...(job.agentAssignments || {}) } as Record<string, string>;
      if (remove ? assignments[agentRole!] !== assigneeId : assignments[agentRole!] === assigneeId) return false;
      const replaced = !remove && assignments[agentRole!] ? assignments[agentRole!] : null;
      if (remove) delete assignments[agentRole!]; else assignments[agentRole!] = assigneeId;
      const ids = [...new Set(Object.values(assignments))];
      const responses = { ...(job.agentResponses || {}) } as Record<string, string>;
      for (const id of Object.keys(responses)) if (!ids.includes(id)) delete responses[id];
      if (!remove && !responses[assigneeId]) responses[assigneeId] = 'pending';
      Object.assign(patch, { agentAssignments: assignments, agentIds: ids, agentResponses: responses });
      if (replaced) {
        const prev = await assigneeInfo('agent', replaced);
        tx.set(jobRef.collection('activity').doc(), { type: 'unassigned', assigneeKind: 'agent', assigneeId: replaced, assigneeName: prev.name, agentRole, note: 'Replaced', by: actor.name, byUid: actor.uid, byRole: actor.role, at: FieldValue.serverTimestamp() });
      }
    } else {
      const field = kind === 'provider' ? 'providerIds' : 'employeeIds';
      const current: string[] = Array.isArray(job[field]) ? job[field] : [];
      if (remove ? !current.includes(assigneeId) : current.includes(assigneeId)) return false;
      patch[field] = remove ? FieldValue.arrayRemove(assigneeId) : FieldValue.arrayUnion(assigneeId);
      if (!remove) Object.assign(patch, { dispatchedBy: actor.uid, dispatchedAt: FieldValue.serverTimestamp() });
    }
    tx.update(jobRef, patch);
    tx.set(jobRef.collection('activity').doc(), {
      type: remove ? 'unassigned' : 'assigned', assigneeKind: kind, assigneeId, assigneeName: info.name, agentRole: kind === 'agent' ? agentRole : null,
      base: info.base, note, by: actor.name, byUid: actor.uid, byRole: actor.role, at: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (changed && !remove) {
    try {
      if (kind === 'agent') {
        if (info.email) await enqueueEmail(`agent-shipment:${jobId}:${agentRole}:${assigneeId}`, {
          category: 'agent', referenceId: jobId, to: info.email,
          subject: `New shipment for ${info.name}: ${AGENT_JOB_ROLES[agentRole!]}`,
          text: `Hi ${info.raw?.contactName || 'there'},\n\nWont Stop Moving assigned ${info.name} a shipment as the ${AGENT_JOB_ROLES[agentRole!].toLowerCase()}.${note ? `\n\nNote from our team: ${note}` : ''}\n\nPlease accept or decline it in your agent dashboard:\nhttps://wontstopmoving.com/dashboard/agent\n\nWont Stop Moving`,
        });
      } else await queueJobEmails(jobId);
    } catch (error) { console.error('Assignment email failed', jobId, error); }
  }
  return changed;
}

/** A field update from someone on the job (or an admin): stage, note, optional location. */
export async function postUpdate(jobId: string, actor: Actor, kind: AssigneeKind | null, update: { stage: Stage; note: string; location: Location | null }) {
  await adminDb().doc(`jobs/${jobId}`).collection('activity').add({
    type: 'update', assigneeKind: kind, assigneeId: actor.uid, assigneeName: actor.name, stage: update.stage, note: update.note, location: update.location,
    by: actor.name, byUid: actor.uid, byRole: actor.role, at: FieldValue.serverTimestamp(),
  });
  if (kind) await adminDb().doc(`jobs/${jobId}`).update({ [`lastUpdate.${actor.uid}`]: { stage: update.stage, at: FieldValue.serverTimestamp() } });
}
