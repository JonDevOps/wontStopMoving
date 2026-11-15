import { NextResponse } from 'next/server';
import { moverRegion } from '@/lib/server/mover-locations';
import { slugify } from '@/lib/location-data';

export async function GET(req: Request) {
  const region = moverRegion(new URL(req.url).searchParams.get('region') || '');
  if (!region) return NextResponse.json({ error: 'Choose a supported state or province.' }, { status: 404 });
  return NextResponse.json({ cities: region.cities.map(name => ({ name, slug: slugify(name) })) }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
