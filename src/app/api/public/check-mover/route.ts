import { NextResponse } from 'next/server';
import { searchCensus } from '@/lib/server/fmcsa';
import { allow, clientIp } from '@/lib/server/rate-limit';
import { US_STATES } from '@/lib/registry';

/** Public: find a moving company by name, USDOT or MC number (free FMCSA data). */
const title = (s: string) => String(s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());

export async function GET(req: Request) {
  if (!allow(`check-search:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 });
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim().slice(0, 80);
  const state = (p.get('state') || '').toUpperCase();
  if (q.length < 2) return NextResponse.json({ error: 'Enter a company name, USDOT or MC number.' }, { status: 400 });
  try {
    const digits = q.replace(/^(usdot|dot|mc|mx)\s*#?\s*/i, '').replace(/\D/g, '');
    let rows;
    if (/^\d{3,9}$/.test(digits) && /^(usdot|dot)?\s*#?\s*\d+$/i.test(q)) {
      rows = await searchCensus(digits, undefined, 5).then(r => r.filter(x => x.dot_number === String(Number(digits))));
      if (!rows.length) rows = await searchCensus(digits, undefined, 5);
    } else rows = await searchCensus(q, US_STATES.includes(state) ? state : undefined, 15);
    return NextResponse.json({
      results: rows.map(r => ({ dot: String(Number(r.dot_number)), name: title(r.dba_name || r.legal_name), legalName: title(r.legal_name), city: title(r.phy_city), state: r.phy_state, active: r.status_code === 'A', trucks: Number(r.power_units || 0) })),
    }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    console.error('Mover search failed', error);
    return NextResponse.json({ error: 'The federal database didn’t answer. Try again shortly.' }, { status: 502 });
  }
}
