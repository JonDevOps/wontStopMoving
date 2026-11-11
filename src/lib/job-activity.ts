/**
 * Who works a move and what they report. Assignments (movers/providers,
 * crew/employees, network agents) and field updates are logged as job
 * activity: who, when, where (optional GPS) and notes.
 * Pure logic (no imports) so it can be unit-tested directly.
 */
export type AssigneeKind = 'provider' | 'employee' | 'agent';
export const ASSIGNEE_LABELS: Record<AssigneeKind, string> = { provider: 'Mover (provider)', employee: 'Crew (employee)', agent: 'Network agent' };
export const AGENT_JOB_ROLES = { origin: 'Origin agent', destination: 'Destination agent', hauling: 'Hauler', storage: 'Storage' } as const;
export type AgentJobRole = keyof typeof AGENT_JOB_ROLES;

export const STAGES = {
  note: 'Note',
  confirmed: 'Confirmed for the job',
  'en-route-pickup': 'On the way to pickup',
  'at-pickup': 'Arrived at pickup',
  loaded: 'Loaded, leaving pickup',
  'en-route-dropoff': 'On the way to drop-off',
  'at-dropoff': 'Arrived at drop-off',
  unloaded: 'Unloaded',
  issue: 'Problem or delay',
  done: 'Finished our part',
} as const;
export type Stage = keyof typeof STAGES;

export type Location = { lat: number; lng: number; accuracy: number | null };

/** A browser geolocation reading, or null if missing or out of range. */
export function cleanLocation(raw: unknown): Location | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = Number(r.lat), lng = Number(r.lng), acc = r.accuracy == null ? null : Number(r.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, accuracy: acc !== null && Number.isFinite(acc) && acc >= 0 ? Math.min(Math.round(acc), 100000) : null };
}

export const mapLink = (l: Location) => `https://www.google.com/maps?q=${l.lat},${l.lng}`;

export type ActivityEntry = {
  type: 'assigned' | 'unassigned' | 'update';
  assigneeKind?: AssigneeKind; assigneeId?: string; assigneeName?: string; agentRole?: AgentJobRole | null;
  stage?: Stage; note?: string; location?: Location | null;
  by: string; byUid: string; byRole: string; at: string | null;
};

/** One-line summary of an activity entry for timelines and emails. */
export function describeActivity(e: ActivityEntry): string {
  const who = e.assigneeName || 'Someone';
  const as = e.assigneeKind === 'agent' && e.agentRole ? AGENT_JOB_ROLES[e.agentRole] : e.assigneeKind ? ASSIGNEE_LABELS[e.assigneeKind].toLowerCase() : '';
  if (e.type === 'assigned') return `${e.by} assigned ${who}${as ? ` as ${as}` : ''}`;
  if (e.type === 'unassigned') return `${e.by} removed ${who}${as ? ` (${as})` : ''}`;
  return `${e.by}: ${e.stage && e.stage !== 'note' ? STAGES[e.stage] : 'Note'}`;
}

/** Current team from the job's assignment fields. */
export function teamFromJob(job: Record<string, any>): { kind: AssigneeKind; id: string; agentRole?: AgentJobRole }[] {
  const out: { kind: AssigneeKind; id: string; agentRole?: AgentJobRole }[] = [];
  for (const id of Array.isArray(job.providerIds) ? job.providerIds : []) out.push({ kind: 'provider', id });
  for (const id of Array.isArray(job.employeeIds) ? job.employeeIds : []) out.push({ kind: 'employee', id });
  for (const [role, id] of Object.entries(job.agentAssignments || {})) if (typeof id === 'string' && role in AGENT_JOB_ROLES) out.push({ kind: 'agent', id, agentRole: role as AgentJobRole });
  return out;
}

/** Is this user on the job's team (any kind)? */
export const isOnTeam = (job: Record<string, any>, uid: string) => teamFromJob(job).some(m => m.id === uid);
