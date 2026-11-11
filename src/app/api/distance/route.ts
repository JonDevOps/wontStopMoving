import { NextResponse } from 'next/server';
import { zipRoadMiles } from '@/lib/server/distance';
import { allow, clientIp } from '@/lib/server/rate-limit';
import { isLongDistance, MILEAGE, mileageFee } from '@/lib/pricing';

/** Public: estimated road miles and mileage fee between two ZIP codes (for the quote form). */
export async function GET(req: Request) {
  if (!allow(`distance:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const p = new URL(req.url).searchParams;
  const from = p.get('from') || '', to = p.get('to') || '';
  if (!/^\d{5}$/.test(from) || !/^\d{5}$/.test(to)) return NextResponse.json({ error: 'Enter two 5-digit ZIP codes.' }, { status: 400 });
  const miles = zipRoadMiles(from, to);
  if (miles === null) return NextResponse.json({ miles: null }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
  return NextResponse.json({ miles, fee: mileageFee(miles), includedMiles: MILEAGE.includedMiles, perMile: MILEAGE.perMile, longDistance: isLongDistance(miles) }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
