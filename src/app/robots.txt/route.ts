import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export function GET() {
  const rules = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=no, ai-train=no',
    'Allow: /',
    'Disallow: /dashboard',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ];
  return new Response(rules.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
