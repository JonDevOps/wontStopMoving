import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Type } from '@google/genai';
import { adminDb } from './firebase-admin';
import { generateJson } from './gemini';
import { ZIPS } from './geo';
import { zipOf, zipsWithin } from '@/lib/market';
import type { MarketEvent } from './market-events';

/**
 * Winning the customers of a moving company that closed, the legitimate way:
 * buy what they leave behind (phone number, website, customer referrals,
 * storage), hire their crews, and be the obvious choice in their area.
 * Progress per company in takeovers/{dot} (server-only).
 */
export const STAGES = {
  new: 'Not started',
  researching: 'Confirming they closed',
  'owner-contacted': 'Owner contacted',
  negotiating: 'Negotiating for assets',
  'assets-acquired': 'Assets acquired',
  'campaign-live': 'Local campaign live',
  done: 'Done',
  passed: 'Not pursuing',
} as const;
export type TakeoverStage = keyof typeof STAGES;
export const ASSETS = {
  phone: 'Phone number (ported to us)', domain: 'Website domain', referrals: 'Referral agreement for their customers', customerList: 'Customer list (bought with consent terms)',
  storage: 'Storage customers / contracts', trucks: 'Trucks or equipment', crew: 'Hired their crew', reviews: 'Owner recommends us on their old listings',
} as const;
export type AssetKey = keyof typeof ASSETS;

export const CAMPAIGN_MILES = 15;

/** ZIPs to target around the closed company, nearest first. */
export function campaignZips(e: Pick<MarketEvent, 'lat' | 'lng' | 'zip'>) {
  const center = e.lat !== null && e.lng !== null ? [e.lat, e.lng] as [number, number] : ZIPS[e.zip];
  return center ? zipsWithin(center, CAMPAIGN_MILES, ZIPS, 120) : [];
}

/** Quote requests from the campaign ZIPs: 90 days before the closure vs since. */
export async function areaResults(zips: string[], effectiveDate: string) {
  const start = Date.parse(`${effectiveDate || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const from = Timestamp.fromMillis(start - 90 * 86400000);
  const snap = await adminDb().collection('quotes').where('createdAt', '>=', from).select('pickupZip', 'pickupAddress', 'createdAt', 'paymentStatus', 'leadSource').limit(10000).get();
  const set = new Set(zips);
  let before = 0, after = 0, bookedAfter = 0, fromCampaign = 0;
  for (const d of snap.docs) {
    const q = d.data();
    const zip = q.pickupZip ? String(q.pickupZip).slice(0, 5) : zipOf(q.pickupAddress);
    if (!set.has(zip)) continue;
    const at = q.createdAt?.toMillis?.() || 0;
    if (at < start) before++; else { after++; if (q.paymentStatus === 'paid') bookedAfter++; if (/mover-closed|takeover/i.test(JSON.stringify(q.leadSource || {}))) fromCampaign++; }
  }
  const days = Math.max(1, Math.round((Date.now() - start) / 86400000));
  return { before90: before, after, bookedAfter, fromCampaign, daysSince: days, perMonthBefore: Math.round((before / 3) * 10) / 10, perMonthAfter: Math.round((after / Math.max(days / 30, 1)) * 10) / 10 };
}

const SCRIPTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ownerCall: { type: Type.STRING, description: 'A short, respectful phone script (under 180 words) for calling the owner: condolences/respect for their years in business, offer to take care of their customers, and to buy their phone number, website domain, customer referrals, storage contracts or equipment. No pressure.' },
    ownerEmail: { type: Type.STRING, description: 'A follow-up email to the owner with the same offer (under 200 words), with a subject line on the first line.' },
    crewText: { type: Type.STRING, description: 'A friendly text message (under 60 words) inviting their former movers and drivers to work with Wont Stop Moving.' },
    adHeadlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: '5 Google Ads headlines, max 30 characters each. Never use the closed company’s name in ad text.' },
    adDescriptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 Google Ads descriptions, max 90 characters each. Never use the closed company’s name.' },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: '10 search keywords for this area, including the closed company’s name as a keyword (allowed) and local terms like "movers near CITY".' },
    communityPost: { type: Type.STRING, description: 'A Nextdoor/Facebook neighborhood post (under 120 words) offering help to anyone whose move fell through, with a link to wontstopmoving.com/mover-closed. Do not name or criticize the closed company.' },
    partnerEmail: { type: Type.STRING, description: 'An email (under 150 words) to local realtors, apartment managers and self-storage facilities in the area offering a reliable mover for their clients, with a subject line on the first line.' },
  },
  required: ['ownerCall', 'ownerEmail', 'crewText', 'adHeadlines', 'adDescriptions', 'keywords', 'communityPost', 'partnerEmail'],
};
export type Scripts = { ownerCall: string; ownerEmail: string; crewText: string; adHeadlines: string[]; adDescriptions: string[]; keywords: string[]; communityPost: string; partnerEmail: string };

/** AI-written outreach for one closed company, saved on its takeover record. */
export async function writeScripts(e: MarketEvent): Promise<Scripts> {
  const name = e.dba || e.name;
  const prompt = `Write outreach for Wont Stop Moving (moving marketplace and mover based in Mountain View, California; phone (415) 214-5474; website wontstopmoving.com) to win the customers of a local moving company that has closed, ethically and legally.

Closed company: ${name}${e.dba ? ` (legal name ${e.name})` : ''}, ${e.city}, ${e.state}. Owner/officer: ${e.officer || 'unknown'}. In business about ${e.years} years with ${e.units} trucks and ${e.drivers} drivers. Federal record: ${e.reason || 'no longer active'}${e.effectiveDate ? ` as of ${e.effectiveDate}` : ''}.

Rules: Be respectful to the owner; never disparage the company or imply affiliation with it; never use its name in ad text (keywords are fine); don't promise anything about their old customers' deposits or claims; customer lists may only be bought with the owner's permission and must be contacted under consent and anti-spam rules.`;
  const out = await generateJson<Scripts>([{ text: prompt }], SCRIPTS_SCHEMA);
  const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v.map(x => clip(x, len)).filter(Boolean).slice(0, n) : []);
  const scripts: Scripts = {
    ownerCall: clip(out.ownerCall, 2000), ownerEmail: clip(out.ownerEmail, 2500), crewText: clip(out.crewText, 500),
    adHeadlines: list(out.adHeadlines, 8, 30), adDescriptions: list(out.adDescriptions, 5, 90), keywords: list(out.keywords, 15, 80),
    communityPost: clip(out.communityPost, 1500), partnerEmail: clip(out.partnerEmail, 2000),
  };
  await adminDb().doc(`takeovers/${e.dot}`).set({ dot: e.dot, scripts, scriptsAt: FieldValue.serverTimestamp() }, { merge: true });
  return scripts;
}
