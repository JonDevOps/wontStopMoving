import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { markLeadContacted } from '@/lib/server/leads';
import { MOVE_PRICING } from '@/lib/pricing';
import { classifyChannel } from '@/lib/attribution';

/** Lead inbox for admins and sales staff: quote requests from the last 60 days. */
type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost';
const ms = (v: any): number | null => v?.toMillis?.() ?? null;
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const LOST_REASONS = ['Price', 'Chose another company', 'Date not available', 'Not moving anymore', 'No response', 'Outside service area', 'Other'];

export async function GET(req: Request) {
  try {
    await requireRole(req, ['employee', 'admin']);
    const db = adminDb();
    const since = Timestamp.fromMillis(Date.now() - 60 * 86400000);
    const snap = await db.collection('quotes').where('createdAt', '>=', since).orderBy('createdAt', 'desc').limit(500).get();
    const docs = snap.docs.filter(d => !d.data().isCustomQuote);
    const repIds = [...new Set(docs.map(d => d.data().assignedTo).filter((v): v is string => typeof v === 'string' && isId(v)))];
    const reps = Object.fromEntries(await Promise.all(repIds.map(async id => [id, ((await db.doc(`users/${id}`).get()).data()?.name as string) || 'Rep'])));

    const leads = docs.map(d => {
      const q = d.data();
      const created = ms(q.createdAt), first = ms(q.firstContactAt);
      const status: LeadStatus = q.status === 'processed' || q.paymentStatus === 'paid' ? 'booked' : q.leadStatus === 'lost' ? 'lost' : first ? 'contacted' : 'new';
      return {
        id: d.id, status, name: q.name || '', phone: q.phone || '', email: q.email || '',
        moveSize: MOVE_PRICING[q.moveSize]?.description || q.moveSize || '', pickup: q.pickupZip || q.pickupAddress || '', dropoff: q.dropoffZip || q.dropoffAddress || '',
        moveDate: q.moveDate || '', estimatedTotal: Number(q.estimatedTotal || 0),
        assignedTo: q.assignedTo || null, assignedName: q.assignedTo ? reps[q.assignedTo] || 'Rep' : null,
        lostReason: q.lostReason || null, createdAt: created, firstContactAt: first, lastContactAt: ms(q.lastContactAt),
        responseMinutes: created && first ? Math.max(0, Math.round((first - created) / 60000)) : null,
        channel: classifyChannel(q.leadSource), referred: typeof q.referralCode === 'string',
        followUpStep: Number(q.followUpStep || 0), followUpsStopped: q.followUpsStopped === true ? (q.followUpsStoppedReason || 'stopped') : null,
      };
    });

    const week = Date.now() - 7 * 86400000, startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const recent = leads.filter(l => (l.createdAt || 0) >= week);
    const responded = recent.map(l => l.responseMinutes).filter((m): m is number => m !== null);
    const decided = leads.filter(l => l.status === 'booked' || l.status === 'lost');
    const metrics = {
      today: leads.filter(l => (l.createdAt || 0) >= startOfDay.getTime()).length,
      waiting: leads.filter(l => l.status === 'new').length,
      medianResponseMinutes: median(responded),
      within5Percent: recent.length ? Math.round((recent.filter(l => l.responseMinutes !== null && l.responseMinutes <= 5).length / recent.length) * 100) : null,
      bookedPercent: leads.length ? Math.round((leads.filter(l => l.status === 'booked').length / leads.length) * 100) : null,
      bookedRevenue: leads.filter(l => l.status === 'booked').reduce((n, l) => n + l.estimatedTotal, 0),
      pipelineValue: leads.filter(l => l.status === 'new' || l.status === 'contacted').reduce((n, l) => n + l.estimatedTotal, 0),
      decided: decided.length,
    };
    // Pipeline breakdown: where leads come from, and how each rep converts them.
    const breakdown = (key: (l: typeof leads[number]) => string) => {
      const groups = new Map<string, { name: string; leads: number; booked: number; lost: number; revenue: number }>();
      for (const l of leads) {
        const name = key(l), g = groups.get(name) || { name, leads: 0, booked: 0, lost: 0, revenue: 0 };
        g.leads++; if (l.status === 'booked') { g.booked++; g.revenue += l.estimatedTotal; } if (l.status === 'lost') g.lost++;
        groups.set(name, g);
      }
      return [...groups.values()].map(g => ({ ...g, bookedPercent: g.leads ? Math.round((g.booked / g.leads) * 100) : 0 })).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
    };
    const lostReasons = breakdown(l => l.status === 'lost' ? l.lostReason || 'Not recorded' : '').filter(g => g.name).map(g => ({ name: g.name, count: g.leads }));
    return NextResponse.json({ leads, metrics, lostReasons: LOST_REASONS, bySource: breakdown(l => l.channel), byRep: breakdown(l => l.assignedName || 'Unassigned'), lostBreakdown: lostReasons }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['employee', 'admin']);
    const { action, id, reason } = await readJson(req);
    if (!isId(id)) throw new HttpError(400, 'Choose a lead.');
    const db = adminDb(), ref = db.doc(`quotes/${id}`);
    const q = (await ref.get()).data();
    if (!q || q.isCustomQuote) throw new HttpError(404, 'Lead not found.');
    switch (action) {
      case 'claim':
        await ref.update({ assignedTo: user.uid, assignedAt: FieldValue.serverTimestamp() });
        break;
      case 'contacted':
        await markLeadContacted(db, id, user.uid);
        break;
      case 'lost':
        if (typeof reason !== 'string' || !LOST_REASONS.includes(reason)) throw new HttpError(400, 'Choose why the lead was lost.');
        if (q.status === 'processed' || q.paymentStatus === 'paid') throw new HttpError(409, 'This lead already booked.');
        await ref.update({ leadStatus: 'lost', lostReason: reason, lostBy: user.uid, lostAt: FieldValue.serverTimestamp() });
        break;
      case 'reopen':
        await ref.update({ leadStatus: q.firstContactAt ? 'contacted' : FieldValue.delete(), lostReason: FieldValue.delete() });
        break;
      default:
        throw new HttpError(400, 'Choose an action.');
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
