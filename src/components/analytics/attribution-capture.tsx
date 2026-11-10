'use client';

import { useEffect } from 'react';
import { cleanLeadSource, type LeadSource } from '@/lib/attribution';

const KEY = 'wsm-lead-source';
const MAX_AGE_MS = 30 * 86400000;

/**
 * Remembers where this visitor first arrived from (ad tags, referring site,
 * referral code) for 30 days, so it can be saved with their quote. A new
 * campaign or referral link replaces an older, untagged visit.
 */
export function AttributionCapture() {
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
      if (!existing || tagged) window.localStorage.setItem(KEY, JSON.stringify(incoming));
    } catch { /* storage blocked: attribution is best-effort */ }
  }, []);
  return null;
}

export function readLeadSource(): LeadSource | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    const source = cleanLeadSource(stored);
    if (!source || (source.firstSeenAt && Date.now() - source.firstSeenAt > MAX_AGE_MS)) return null;
    return source;
  } catch { return null; }
}
