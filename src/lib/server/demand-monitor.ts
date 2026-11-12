import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { fetchPublicFeed } from './safe-fetch';
import { matchDemand, parseFeed } from '@/lib/demand';

/**
 * Hourly: reads each configured feed (settings/demandMonitor) and saves new
 * posts that look like someone hiring movers to demandSignals/{hash of link}.
 * Feeds that fail are recorded on the settings doc and retried next hour.
 */
export type DemandSettings = { feeds: string[]; places: string[] };
const BLOCKED_HOSTS = /(^|\.)craigslist\.org$/i; // Terms forbid automated access.

export async function demandSettings(): Promise<DemandSettings & { feedStatus: Record<string, string> }> {
  const d = (await adminDb().doc('settings/demandMonitor').get()).data() || {};
  return {
    feeds: Array.isArray(d.feeds) ? d.feeds.filter((f: unknown): f is string => typeof f === 'string') : [],
    places: Array.isArray(d.places) ? d.places.filter((p: unknown): p is string => typeof p === 'string') : [],
    feedStatus: d.feedStatus || {},
  };
}

export function cleanFeeds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s+/) : [];
  return [...new Set(list.map(v => String(v).trim()).filter(u => {
    try { const url = new URL(u); return /^https?:$/.test(url.protocol) && !BLOCKED_HOSTS.test(url.hostname); } catch { return false; }
  }))].slice(0, 25);
}

export async function runDemandMonitor() {
  const settings = await demandSettings();
  if (!settings.feeds.length) return { feeds: 0, found: 0 };
  const db = adminDb();
  let found = 0;
  const status: Record<string, string> = {};
  for (const feed of settings.feeds) {
    const key = createHash('sha1').update(feed).digest('hex').slice(0, 12);
    try {
      const items = parseFeed(await fetchPublicFeed(feed));
      status[key] = `ok ${new Date().toISOString()} (${items.length} posts)`;
      for (const item of items) {
        const match = matchDemand(item, settings.places);
        if (!match || !item.link) continue;
        const ref = db.doc(`demandSignals/${createHash('sha1').update(item.link).digest('hex').slice(0, 24)}`);
        try {
          await ref.create({ ...item, ...match, feed, status: 'new', foundAt: FieldValue.serverTimestamp() });
          found++;
        } catch { /* Already saved. */ }
      }
    } catch (error) {
      status[key] = `error ${new Date().toISOString()}: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`;
    }
  }
  await db.doc('settings/demandMonitor').set({ feedStatus: status, lastRunAt: FieldValue.serverTimestamp() }, { merge: true });
  return { feeds: settings.feeds.length, found };
}
