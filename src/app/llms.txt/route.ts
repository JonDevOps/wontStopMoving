import { llmsTxt } from '@/lib/llms';

// Generated at build time from the site's real data.
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
