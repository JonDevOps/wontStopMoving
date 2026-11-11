import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, requireRole } from '@/lib/server/auth';

/** Provider scorecards: volume, quality and money, per provider. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [providers, jobs, claims] = await Promise.all([
      db.collection('providers').limit(1000).get(),
      db.collection('jobs').select('providerIds', 'status', 'amountPaid', 'payoutStatus', 'completedAt', 'moveDate').limit(10000).get(),
      db.collection('serviceRequests').where('type', '==', 'claim').select('jobId', 'status').limit(2000).get(),
    ]);
    const jobProvider = new Map<string, string[]>();
    const stats = new Map<string, { assigned: number; completed: number; cancelled: number; paidOut: number; pendingPayout: number; lastJob: string; claims: number; openClaims: number }>();
    const get = (id: string) => { let s = stats.get(id); if (!s) { s = { assigned: 0, completed: 0, cancelled: 0, paidOut: 0, pendingPayout: 0, lastJob: '', claims: 0, openClaims: 0 }; stats.set(id, s); } return s; };
    for (const d of jobs.docs) {
      const j = d.data(), ids: string[] = Array.isArray(j.providerIds) ? j.providerIds : [];
      jobProvider.set(d.id, ids);
      for (const id of ids) {
        const s = get(id);
        s.assigned++;
        if (j.status === 'cancelled') s.cancelled++;
        if (j.status === 'completed') {
          s.completed++;
          const payout = Math.round(Number(j.amountPaid || 0) * 0.85 * 100) / 100;
          if (j.payoutStatus === 'paid') s.paidOut += payout; else s.pendingPayout += payout;
          const when = j.completedAt?.toDate?.().toISOString().slice(0, 10) || j.moveDate || '';
          if (when > s.lastJob) s.lastJob = when;
        }
      }
    }
    for (const d of claims.docs) for (const id of jobProvider.get(d.data().jobId) || []) { const s = get(id); s.claims++; if (d.data().status !== 'resolved') s.openClaims++; }
    const scorecards = providers.docs.map(d => {
      const p = d.data(), s = get(d.id);
      return {
        id: d.id, name: p.businessName || p.name || 'Provider', email: p.email || '', status: p.status || 'pending', payoutsReady: !!p.stripeOnboardingComplete,
        state: p.state || '', rating: Number(p.rating || 0), reviewCount: Number(p.reviewCount || 0), ...s,
        completionRate: s.assigned ? Math.round((s.completed / s.assigned) * 100) : null,
        claimRate: s.completed ? Math.round((s.claims / s.completed) * 100) : null,
      };
    }).sort((a, b) => b.completed - a.completed || b.rating - a.rating);
    return NextResponse.json({ scorecards }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
