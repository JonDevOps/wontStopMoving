import { SITE_EMAIL, SITE_NAME, SITE_PHONE, SITE_URL } from '@/lib/seo';

/** "Save our contact": a vCard phones can add straight to their contacts. */
export function GET() {
  const card = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${SITE_NAME}`,
    `ORG:${SITE_NAME}`,
    `TEL;TYPE=WORK,VOICE:${SITE_PHONE}`,
    `EMAIL;TYPE=WORK:${SITE_EMAIL}`,
    `URL:${SITE_URL}`,
    'NOTE:Moving quotes and bookings across the U.S.\\, Puerto Rico and Canada.',
    'END:VCARD',
    '',
  ].join('\r\n');
  return new Response(card, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wont-stop-moving.vcf"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
