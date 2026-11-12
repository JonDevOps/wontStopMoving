/**
 * Directory & partner outreach tracker: every listing site, marketplace and
 * van line we should be on, with its status. The starting list lives here;
 * progress is saved per entry in outreach/{id} (server-only). Custom entries
 * and registry brokers are added from the admin page.
 */
export type OutreachKind = 'listing' | 'marketplace' | 'review' | 'van-line' | 'broker' | 'other';
export type OutreachStatus = 'todo' | 'in-progress' | 'listed' | 'declined';

export const OUTREACH_KINDS: Record<OutreachKind, string> = {
  listing: 'Maps & business listings',
  review: 'Review sites',
  marketplace: 'Lead marketplaces',
  'van-line': 'Van lines (agent programs)',
  broker: 'Moving brokers',
  other: 'Other',
};
export const OUTREACH_STATUSES: Record<OutreachStatus, string> = {
  todo: 'To do', 'in-progress': 'In progress', listed: 'Listed / partnered', declined: 'Skipped',
};

export type OutreachSeed = { id: string; name: string; kind: OutreachKind; url: string; why: string };

export const OUTREACH_SEED: OutreachSeed[] = [
  { id: 'google-business', name: 'Google Business Profile', kind: 'listing', url: 'https://business.google.com/', why: 'Google Maps and the local pack: the biggest source of local moving searches.' },
  { id: 'apple-business', name: 'Apple Business Connect', kind: 'listing', url: 'https://businessconnect.apple.com/', why: 'Apple Maps and Siri on every iPhone.' },
  { id: 'bing-places', name: 'Bing Places', kind: 'listing', url: 'https://www.bingplaces.com/', why: 'Bing, Copilot and ChatGPT search results.' },
  { id: 'waze', name: 'Waze Ads / Waze listing', kind: 'listing', url: 'https://www.waze.com/business/', why: 'Drivers near the office or storage.' },
  { id: 'facebook', name: 'Facebook Page', kind: 'listing', url: 'https://www.facebook.com/pages/create', why: 'Reviews, Marketplace and local moving groups.' },
  { id: 'nextdoor', name: 'Nextdoor Business Page', kind: 'listing', url: 'https://business.nextdoor.com/', why: 'Neighbors asking "who did your move?".' },
  { id: 'crunchbase', name: 'Crunchbase', kind: 'listing', url: 'https://www.crunchbase.com/', why: 'Company profile for partners, press and investors.' },
  { id: 'yelp', name: 'Yelp', kind: 'review', url: 'https://biz.yelp.com/', why: 'Top review site for movers; feeds Apple Maps reviews.' },
  { id: 'trustpilot', name: 'Trustpilot', kind: 'review', url: 'https://business.trustpilot.com/', why: 'Trust badge for long-distance customers.' },
  { id: 'bbb', name: 'Better Business Bureau', kind: 'review', url: 'https://www.bbb.org/get-accredited', why: 'Movers are checked here; FMCSA links to it.' },
  { id: 'mymovingreviews', name: 'MyMovingReviews', kind: 'review', url: 'https://www.mymovingreviews.com/', why: 'Moving-only reviews that rank well in search.' },
  { id: 'angi', name: 'Angi', kind: 'marketplace', url: 'https://www.angi.com/pros', why: 'Paid leads from homeowners.' },
  { id: 'thumbtack', name: 'Thumbtack', kind: 'marketplace', url: 'https://www.thumbtack.com/pro', why: 'Pay-per-lead local moves and labor.' },
  { id: 'taskrabbit', name: 'TaskRabbit', kind: 'marketplace', url: 'https://www.taskrabbit.com/become-a-tasker', why: 'Small moves and help-only jobs.' },
  { id: 'hireahelper', name: 'HireAHelper', kind: 'marketplace', url: 'https://www.hireahelper.com/', why: 'Loading help for PODS and rental-truck customers.' },
  { id: 'bellhop', name: 'Bellhop', kind: 'marketplace', url: 'https://www.getbellhop.com/', why: 'Overflow jobs and crews.' },
  { id: 'moving-staffers', name: 'Moving Staffers', kind: 'marketplace', url: 'https://www.movingstaffers.com/', why: 'Labor-only jobs for container moves.' },
  { id: 'pack-and-load', name: 'Pack & Load Services', kind: 'marketplace', url: 'https://www.packloadservices.com/', why: 'Labor jobs for U-Pack and PODS customers.' },
  { id: 'move-org', name: 'Move.org', kind: 'marketplace', url: 'https://www.move.org/', why: 'Comparison site with mover listings.' },
  { id: 'moving-com', name: 'Moving.com', kind: 'marketplace', url: 'https://www.moving.com/', why: 'Lead network for long-distance moves.' },
  { id: 'imoving', name: 'iMoving', kind: 'marketplace', url: 'https://www.imoving.com/', why: 'Instant-price marketplace.' },
  { id: 'movingwaldo', name: 'MovingWaldo', kind: 'marketplace', url: 'https://www.movingwaldo.com/', why: 'Moving checklist site with mover quotes.' },
  { id: 'unpakt', name: 'Unpakt', kind: 'marketplace', url: 'https://www.unpakt.com/', why: 'Book-online moving marketplace.' },
  { id: 'movematcher', name: 'MoveMatcher', kind: 'marketplace', url: 'https://www.movematcher.com/', why: 'Long-distance lead network.' },
  { id: 'uship', name: 'uShip', kind: 'marketplace', url: 'https://www.uship.com/', why: 'Bid on single items, furniture and small moves.' },
  { id: 'united', name: 'United Van Lines', kind: 'van-line', url: 'https://www.unitedvanlines.com/', why: 'Agent program: interstate volume and national accounts.' },
  { id: 'allied', name: 'Allied Van Lines', kind: 'van-line', url: 'https://www.allied.com/', why: 'Agent program; white-glove and corporate moves.' },
  { id: 'mayflower', name: 'Mayflower Transit', kind: 'van-line', url: 'https://www.mayflower.com/', why: 'Agent program (UniGroup).' },
  { id: 'atlas', name: 'Atlas Van Lines', kind: 'van-line', url: 'https://www.atlasvanlines.com/', why: 'Agent-owned van line; storage and military moves.' },
  { id: 'north-american', name: 'North American Van Lines', kind: 'van-line', url: 'https://www.northamerican.com/', why: 'Agent program; corporate relocation.' },
  { id: 'national', name: 'National Van Lines', kind: 'van-line', url: 'https://www.nationalvanlines.com/', why: 'Family-owned van line; agent openings.' },
  { id: 'american-van-lines', name: 'American Van Lines', kind: 'van-line', url: 'https://www.americanvanlines.com/', why: 'Long-distance partner for overflow.' },
  { id: 'international-van-lines', name: 'International Van Lines', kind: 'van-line', url: 'https://www.ivl.com/', why: 'International and long-distance overflow.' },
];

export const isOutreachKind = (v: unknown): v is OutreachKind => typeof v === 'string' && v in OUTREACH_KINDS;
export const isOutreachStatus = (v: unknown): v is OutreachStatus => typeof v === 'string' && v in OUTREACH_STATUSES;
/** Safe Firestore id from a name. */
export const outreachId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
