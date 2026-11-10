import { NextResponse } from 'next/server';
import { lookupZip } from '@/lib/server/zip';

/** Public ZIP lookup: city, state and whether we serve it. Cached for a day. */
export async function GET(_req: Request, { params }: { params: Promise<{ zip: string }> }) {
  const info = lookupZip((await params).zip);
  if (!info) return NextResponse.json({ error: 'ZIP code not found.' }, { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } });
  return NextResponse.json(info, { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
}
