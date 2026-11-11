import { NextResponse } from 'next/server';
import { activeInsuranceFor, authorityFor, censusByDots, coverageTotals, revocationsFor } from '@/lib/server/fmcsa';
import { allow, clientIp } from '@/lib/server/rate-limit';
import { moverVerdict } from '@/lib/market';

/** Public: one mover's federal record and a plain-English verdict. */
const title = (s: string) => String(s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());

export async function GET(req: Request, { params }: { params: Promise<{ dot: string }> }) {
  if (!allow(`check-detail:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'Too many lookups. Try again in a minute.' }, { status: 429 });
  const { dot } = await params;
  if (!/^\d{1,9}$/.test(dot)) return NextResponse.json({ error: 'Not a USDOT number.' }, { status: 400 });
  try {
    const [census, auth, policies, revs] = await Promise.all([censusByDots([dot]), authorityFor(dot), activeInsuranceFor(dot), revocationsFor([dot])]);
    const c = census[0];
    if (!c) return NextResponse.json({ error: 'No company with that USDOT number.' }, { status: 404 });
    const best = auth.find(a => a.hhg && a.common) || auth.find(a => a.common) || auth[0];
    const cover = coverageTotals(policies);
    const added = /^\d{8}$/.test(c.add_date || '') ? `${c.add_date.slice(0, 4)}-${c.add_date.slice(4, 6)}-${c.add_date.slice(6)}` : '';
    const years = added ? Math.max(0, Math.floor((Date.now() - Date.parse(added)) / (365.25 * 86400000))) : 0;
    const revokedOn = (revs.get(String(Number(dot))) || []).map(r => r.date).filter(Boolean).sort().reverse()[0] || null;
    const facts = {
      status: c.status_code || '', interstate: c.carrier_operation === 'A', hhgAuthority: best ? best.hhg : null, commonActive: best ? best.common : null, brokerActive: auth.some(a => a.broker),
      liabilityOnFile: cover.liability || null, cargoOnFile: cover.cargo || null, revokedOn: best?.common ? null : revokedOn, years, safety: c.safety_rating || '', state: c.phy_state || '', units: Number(c.power_units || 0),
    };
    return NextResponse.json({
      company: { dot: String(Number(dot)), mc: best?.mc || '', name: title(c.dba_name || c.legal_name), legalName: title(c.legal_name), city: title(c.phy_city), state: c.phy_state, trucks: Number(c.power_units || 0), drivers: Number(c.total_drivers || 0), since: added, householdGoods: c.crgo_household === 'X' },
      facts, verdict: moverVerdict(facts),
      links: { safer: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${Number(dot)}`, protectYourMove: 'https://www.fmcsa.dot.gov/protect-your-move' },
    }, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (error) {
    console.error('Mover check failed', dot, error);
    return NextResponse.json({ error: 'The federal database didn’t answer. Try again shortly.' }, { status: 502 });
  }
}
