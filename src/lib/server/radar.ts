import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { enqueueEmail } from './notifications';
import { listEvents, type MarketEvent } from './market-events';
import { inWatch, radarSettings } from './market';
import { loadNewCarriers } from './registry-store';
import { CATEGORY_LABEL, categoriesOf, newCarrierAlerts, type CarrierTuple } from '@/lib/carriers';
import { REGION_PRESETS } from '@/lib/regions';

/**
 * The daily market radar email: in your watched areas, moving companies
 * that closed (customers to win), opened (people to recruit), grew or
 * shrank; new freight, car-carrier and other partner carriers (after each
 * census import); competitors you passed; and partner compliance alerts.
 */
const nice = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, w => w.toUpperCase());
const line = (e: MarketEvent) => `${nice(e.dba || e.name)}, ${nice(e.city)} ${e.state} · ${e.units} truck${e.units === 1 ? '' : 's'}${e.phone ? ` · ${e.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}` : ''}`;

export async function sendDailyRadar(force = false) {
  const settings = await radarSettings();
  const day = new Date().toISOString().slice(0, 10), since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const db = adminDb();
  const [events, passes, alerts, newCarriers] = await Promise.all([
    listEvents({ sinceDay: since }),
    db.collection('competitors').where('passedAt', '>=', Timestamp.fromMillis(Date.now() - 86400000)).select('name', 'tier').get(),
    db.collection('networkAlerts').where('at', '>=', Timestamp.fromMillis(Date.now() - 86400000)).get(),
    loadNewCarriers().catch(() => null),
  ]);
  // New partner carriers: once per census import (it runs before the radar), in the watched areas.
  const partners = newCarrierAlerts(newCarriers, Date.now(), (state, t) => inWatch(settings, { state, county: t[5] }));
  const local = events.filter(e => inWatch(settings, e));
  const by = (t: MarketEvent['type']) => local.filter(e => e.type === t);
  const closed = by('closed'), opened = by('new'), grew = by('grew'), shrank = by('shrank');
  const total = closed.length + opened.length + grew.length + shrank.length + partners.length + passes.size + alerts.size;
  if (!total && !force) return { sent: false };
  const areas = [...settings.regions.map(r => REGION_PRESETS[r].label), ...settings.states].join(', ');
  const section = (title: string, items: string[], hint: string) => (items.length ? `${title} (${items.length})\n${hint}\n${items.slice(0, 25).map(i => `  • ${i}`).join('\n')}${items.length > 25 ? `\n  …and ${items.length - 25} more` : ''}\n\n` : '');
  const text = `Market radar for ${areas}, ${day}\n\n`
    + section('CLOSED: customers to win', closed.map(e => `${line(e)} · ${e.reason || 'no longer active'}${e.effectiveDate ? ` (${e.effectiveDate})` : ''}`), 'Open each in Market Radar for the takeover playbook (call the owner, hire the crew, run the local campaign).')
    + section('NEW: movers to recruit early', opened.map(line), 'New registrations: invite them to the agent network before a van line does.')
    + section('NEW CARRIERS: possible partners', partners.map(({ state, t, score }) => partnerLine(state, t, score)), 'Freight, car carriers and other haulers new to the DOT list near you: reach out before they’re busy. Open the partner shortlist in the mover registry.')
    + section('GREW', grew.map(e => `${line(e)} · ${e.from} → ${e.to} trucks`), 'Competitors adding trucks.')
    + section('SHRANK', shrank.map(e => `${line(e)} · ${e.from} → ${e.to} trucks`), 'Possible trouble: watch for closure, crews looking for work, or an acquisition.')
    + section('COMPETITORS YOU PASSED', passes.docs.map(d => `${d.data().name}${d.data().tier === 'legend' ? ' (legend!)' : ''}`), 'Nice work.')
    + section('PARTNER COMPLIANCE ALERTS', alerts.docs.map(d => `${d.data().name}: ${(d.data().issues || []).join('; ')}`), 'Pause assignments until it’s fixed.')
    + `Open Market Radar:\nhttps://wontstopmoving.com/dashboard/admin/market\n\nWont Stop Moving`;
  await enqueueEmail(`market-radar:${day}`, { category: 'radar', referenceId: day, to: settings.email, subject: `Market radar: ${closed.length} closed, ${opened.length} new${partners.length ? `, ${partners.length} new partner carriers` : ''}${passes.size ? `, ${passes.size} passed` : ''}`, text });
  return { sent: true, closed: closed.length, opened: opened.length, partners: partners.length };
}

const partnerLine = (state: string, t: CarrierTuple, score: number) =>
  `${nice(t[2] || t[1])}, ${nice(t[3])} ${state} · ${categoriesOf(t[13]).filter(k => k !== 'household').map(k => CATEGORY_LABEL[k]).join(', ')} · ${t[8]} truck${t[8] === 1 ? '' : 's'}${t[6] ? ` · ${t[6].replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}` : ''} · fit ${score}/100`;
