'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cleanLeadSource, type LeadSource } from '@/lib/attribution';

const KEY = 'wsm-lead-source';
const PAGES_KEY = 'wsm-pages-visited';
const MAX_AGE_MS = 30 * 86400000;

/**
 * Remembers where this visitor first arrived from (ad tags, referring site,
 * referral code) for 30 days, so it can be saved with their quote. A new
 * campaign or referral link replaces an older, untagged visit.
 */
export function AttributionCapture() {
  const pathname = usePathname();
  // Page trail for the lead inbox (#166): last 25 pages, skipping repeats and dashboards.
  useEffect(() => {
    try {
      if (!pathname || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) return;
      const pages: string[] = JSON.parse(window.localStorage.getItem(PAGES_KEY) || '[]');
      if (pages[pages.length - 1] !== pathname) {
        pages.push(pathname);
        window.localStorage.setItem(PAGES_KEY, JSON.stringify(pages.slice(-25)));
      }
    } catch { /* storage blocked */ }
  }, [pathname]);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = (params.get('ref') || '').toUpperCase();
      let referrerHost = '';
      try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* no referrer */ }
      const incoming = cleanLeadSource({
        utmSource: params.get('utm_source'), utmMedium: params.get('utm_medium'), utmCampaign: params.get('utm_campaign'),
        referrerHost: referrerHost && !referrerHost.endsWith('wontstopmoving.com') && referrerHost !== window.location.hostname ? referrerHost : undefined,
        landingPath: window.location.pathname, refCode: refCode || undefined, firstSeenAt: Date.now(),
      });
      const existing = readLeadSource();
      const tagged = !!(incoming?.refCode || incoming?.utmSource || incoming?.utmMedium || incoming?.referrerHost);
      if (!existing || tagged) {
        window.localStorage.setItem(KEY, JSON.stringify(incoming));
        // A new visit source starts a new page trail.
        if (existing) window.localStorage.setItem(PAGES_KEY, JSON.stringify([window.location.pathname]));
      }
    } catch { /* storage blocked: attribution is best-effort */ }
  }, []);
  return null;
}

export function readLeadSource(): LeadSource | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (stored && typeof stored === 'object') stored.pagesVisited = JSON.parse(window.localStorage.getItem(PAGES_KEY) || '[]');
    const source = cleanLeadSource(stored);
    if (!source || (source.firstSeenAt && Date.now() - source.firstSeenAt > MAX_AGE_MS)) return null;
    return source;
  } catch { return null; }
}
