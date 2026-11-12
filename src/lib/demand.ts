/**
 * Demand monitor: finds posts from people looking for movers in RSS/Atom
 * feeds the team chooses (Google Alerts, local news, forums that allow
 * feeds). Only public feeds are read; sites whose terms forbid scraping
 * (such as Craigslist) are never fetched. Pure parsing and matching here.
 */
export type FeedItem = { title: string; link: string; text: string; published: string | null };

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block: string, names: string[]) => {
  for (const n of names) { const m = block.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`, 'i')); if (m) return m[1]; }
  return '';
};

/** RSS <item> and Atom <entry> blocks → items (max 100). */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(m => m[0]).slice(0, 100);
  return blocks.map(b => {
    const atomLink = b.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || '';
    const link = decode(tag(b, ['link'])) || atomLink;
    const date = decode(tag(b, ['pubDate', 'published', 'updated', 'dc:date']));
    const t = Date.parse(date);
    return {
      title: decode(tag(b, ['title'])).slice(0, 300),
      link: /^https?:\/\//i.test(link) ? link.slice(0, 1000) : '',
      text: decode(tag(b, ['description', 'summary', 'content', 'content:encoded'])).slice(0, 2000),
      published: Number.isNaN(t) ? null : new Date(t).toISOString(),
    };
  }).filter(i => i.title || i.text);
}

/** Phrases that mean someone wants to hire movers (not job ads, not "we are moving our office hours"). */
export const DEMAND_PHRASES = [
  'need movers', 'need a mover', 'looking for movers', 'looking for a mover', 'recommend a mover', 'recommend movers', 'mover recommendation',
  'moving company recommendation', 'recommend a moving company', 'any good movers', 'best movers', 'hire movers', 'need help moving',
  'moving help', 'quote for moving', 'moving quote', 'need someone to move', 'help me move', 'cheap movers', 'affordable movers',
];
const NOT_DEMAND = /\b(hiring|now hiring|job opening|we are hiring|apply now|careers?|for sale)\b/i;

export type DemandMatch = { phrases: string[]; places: string[]; score: number };

/** Scores a post: a demand phrase is required; mentioning a watched place ranks it higher. */
export function matchDemand(item: Pick<FeedItem, 'title' | 'text'>, places: string[] = []): DemandMatch | null {
  const hay = `${item.title} ${item.text}`.toLowerCase();
  if (NOT_DEMAND.test(hay)) return null;
  const phrases = DEMAND_PHRASES.filter(p => hay.includes(p));
  if (!phrases.length) return null;
  const hits = places.filter(p => p.trim().length > 2 && new RegExp(`\\b${p.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay));
  return { phrases, places: hits, score: Math.min(100, 40 + phrases.length * 10 + hits.length * 25) };
}
