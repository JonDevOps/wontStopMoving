import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { classifyChannel, CHANNELS } from '@/lib/attribution';

/**
 * Owner dashboard: bookings, revenue, payouts and marketing efficiency for a
 * period. Marketing spend is entered by month (marketingSpend/{YYYY-MM}) so
 * cost per booking can be calculated per channel.
 */
const PLATFORM_SHARE = 0.15;
const round = (n: number) => Math.round(n * 100) / 100;
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 30, 7), 366);
    const since = new Date(Date.now() - days * 86400000);
    const db = adminDb();
    const [paid, quotes, spendDocs] = await Promise.all([
      db.collection('jobs').where('paidAt', '>=', Timestamp.fromDate(since)).limit(10000).get(),
      db.collection('quotes').where('createdAt', '>=', Timestamp.fromDate(since)).select('isCustomQuote', 'leadSource', 'status', 'paymentStatus').limit(20000).get(),
      db.collection('marketingSpend').where('month', '>=', monthKey(since)).limit(24).get(),
    ]);

    let gmv = 0, payoutsPaid = 0, payoutsPending = 0, bookings = 0, cancelled = 0, completed = 0;
    const byChannel = new Map<string, { bookings: number; revenue: number; leads: number }>(CHANNELS.map(c => [c, { bookings: 0, revenue: 0, leads: 0 }]));
    const quoteChannel = new Map<string, string>();
    for (const q of quotes.docs) {
      if (q.data().isCustomQuote) continue;
      const ch = classifyChannel(q.data().leadSource);
      quoteChannel.set(q.id, ch);
      byChannel.get(ch)!.leads++;
    }
    const byDay = new Map<string, number>();
    for (const d of paid.docs) {
      const j = d.data();
      const amount = Number(j.amountPaid || 0);
      bookings++; gmv += amount;
      if (j.status === 'cancelled') cancelled++;
      if (j.status === 'completed') {
        completed++;
        if (j.payoutStatus === 'paid') payoutsPaid += amount * (1 - PLATFORM_SHARE); else payoutsPending += amount * (1 - PLATFORM_SHARE);
      }
      const day = j.paidAt?.toDate?.().toISOString().slice(0, 10);
      if (day) byDay.set(day, (byDay.get(day) || 0) + amount);
      const ch = j.quoteId ? quoteChannel.get(j.quoteId) || 'Direct' : 'Direct';
      const g = byChannel.get(ch) || byChannel.get('Direct')!;
      g.bookings++; g.revenue += amount * PLATFORM_SHARE;
    }

    const spendByChannel = new Map<string, number>();
    const spendMonths = spendDocs.docs.map(d => ({ month: d.data().month as string, channels: (d.data().channels || {}) as Record<string, number> }));
    for (const m of spendMonths) for (const [ch, amt] of Object.entries(m.channels)) spendByChannel.set(ch, (spendByChannel.get(ch) || 0) + Number(amt || 0));
    const totalSpend = [...spendByChannel.values()].reduce((n, v) => n + v, 0);

    const nonCustomQuotes = quotes.docs.filter(q => !q.data().isCustomQuote).length;
    return NextResponse.json({
      days,
      totals: {
        gmv: round(gmv), platformRevenue: round(gmv * PLATFORM_SHARE), payoutsPaid: round(payoutsPaid), payoutsPending: round(payoutsPending),
        bookings, completed, cancelled, averageOrder: bookings ? round(gmv / bookings) : 0,
        quotes: nonCustomQuotes, quoteToBookingPercent: nonCustomQuotes ? Math.round((bookings / nonCustomQuotes) * 100) : null,
        marketingSpend: round(totalSpend), costPerBooking: bookings && totalSpend ? round(totalSpend / bookings) : null,
      },
      channels: [...byChannel.entries()].map(([name, g]) => {
        const spend = spendByChannel.get(name) || 0;
        return { name, leads: g.leads, bookings: g.bookings, revenue: round(g.revenue), spend: round(spend), costPerBooking: g.bookings && spend ? round(spend / g.bookings) : null, returnOnSpend: spend ? round(g.revenue / spend) : null };
      }).filter(c => c.leads || c.bookings || c.spend).sort((a, b) => b.revenue - a.revenue),
      daily: [...byDay.entries()].sort().map(([day, amount]) => ({ day, amount: round(amount) })),
      spendMonths, channelNames: CHANNELS,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Save one month's marketing spend by channel. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { month, channels } = await readJson(req);
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'Choose a month.');
    if (!channels || typeof channels !== 'object') throw new HttpError(400, 'Enter spend by channel.');
    const clean: Record<string, number> = {};
    for (const ch of CHANNELS) {
      const v = (channels as Record<string, unknown>)[ch];
      if (v === undefined || v === '' || v === null) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new HttpError(400, `Check the amount for ${ch}.`);
      if (n > 0) clean[ch] = round(n);
    }
    await adminDb().doc(`marketingSpend/${month}`).set({ month, channels: clean, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}
