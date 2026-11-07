import { pricingMd } from '@/lib/llms';

// Generated at build time from the site's real data.
export const dynamic = 'force-static';

export function GET() {
  return new Response(pricingMd(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
