/**
 * Finding a moving company's own website when the federal record doesn't
 * list one: likely domains to try, which search results to skip, and
 * whether a page is really that company (its phone, USDOT number, or name
 * plus city on the page).
 */

const SUFFIXES = /\b(l\.?l\.?c|inc|incorporated|corp|corporation|co|company|ltd|limited|pllc|lp|llp|the|dba)\b\.?/gi;
const GENERIC = new Set(['moving', 'movers', 'mover', 'move', 'moves', 'and', 'services', 'service', 'transport', 'transportation', 'trucking', 'storage', 'relocation', 'relocations', 'logistics', 'express', 'van', 'lines', 'line', 'delivery', 'hauling', 'group', 'enterprises', 'enterprise', 'solutions', 'of', 'for', 'usa', 'us']);

/** "ACME MOVING & STORAGE, LLC" → "acmemovingstorage". */
export function nameStem(name: string): string {
  return name.toLowerCase().replace(/&/g, ' ').replace(SUFFIXES, ' ').replace(/[^a-z0-9]+/g, '');
}

/** Distinctive words in a company name (not "moving", "LLC", ...). */
export function nameTokens(name: string): string[] {
  return [...new Set(name.toLowerCase().replace(SUFFIXES, ' ').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !GENERIC.has(w)))];
}

/** Domains worth trying for a company, most likely first (at most 6). */
export function guessDomains(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names.filter(Boolean)) {
    const stem = nameStem(n);
    if (stem.length < 4 || stem.length > 40) continue;
    const core = stem.replace(/(moving|movers|mover|andstorage|storage)+$/, '');
    out.push(`${stem}.com`);
    if (core.length >= 4 && core !== stem) out.push(`${core}.com`, `${core}movers.com`, `${core}moving.com`);
    else out.push(`${stem}movers.com`, `${stem}moving.com`);
  }
  return [...new Set(out)].slice(0, 6).map(d => `https://${d}`);
}

/** Sites that list many companies; a search hit there isn't the company's own website. */
const DIRECTORY = /(^|\.)(yelp|facebook|instagram|linkedin|twitter|x|tiktok|youtube|bbb|google|goo|mapquest|yellowpages|angi|angieslist|homeadvisor|thumbtack|nextdoor|manta|bizapedia|opencorporates|dnb|zoominfo|buzzfile|chamberofcommerce|moving|movingcompanyreviews|mymovingreviews|movebuddha|moversdb|unpakt|moverreviews|trustpilot|indeed|glassdoor|carriersource|safer|dot|fmcsa|truckingdatabase|wikipedia|apple|bing|brave|amazon|craigslist|porch|bark|expertise|superpages|citysearch|whitepages|allbiz|cylex|hotfrog|merchantcircle|ezlocal|birdeye|loc8nearyou|uship|vertexaisearch)\.[a-z.]+$/i;

export function isDirectory(url: string): boolean {
  try { const host = new URL(url).hostname.replace(/^www\./, ''); return DIRECTORY.test(host) || /\.(gov|mil|edu)$/i.test(host); } catch { return true; }
}

/** Phone written any common way: (650) 555-1234, 650.555.1234, 6505551234, +1 650 555 1234. */
function phoneOnPage(phone: string, text: string): boolean {
  const d = phone.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return false;
  return new RegExp(`\\(?${d.slice(0, 3)}\\)?[\\s.\\-]*${d.slice(3, 6)}[\\s.\\-]*${d.slice(6)}(?!\\d)`).test(text);
}

export type PageMatch = { ok: boolean; matchedBy: string[] };

/**
 * Is this page the company's own? Yes if it shows their phone or USDOT
 * number, or all the distinctive words of their name plus their city.
 */
export function matchPage(m: { name: string; dba?: string; city: string; phone?: string; cell?: string; dot: string }, page: { text: string; title?: string }): PageMatch {
  const text = `${page.title || ''}\n${page.text}`, lower = text.toLowerCase();
  const matchedBy: string[] = [];
  if ((m.phone && phoneOnPage(m.phone, text)) || (m.cell && phoneOnPage(m.cell, text))) matchedBy.push('phone');
  if (new RegExp(`(us\\s*)?dot[^0-9a-z]{0,12}${m.dot}(?!\\d)`, 'i').test(text)) matchedBy.push('USDOT number');
  const named = [m.dba, m.name].filter(Boolean).some(n => { const t = nameTokens(n as string); return t.length > 0 && t.every(w => lower.includes(w)); });
  const city = m.city && lower.includes(m.city.toLowerCase());
  if (named) matchedBy.push('name');
  if (city) matchedBy.push('city');
  return { ok: matchedBy.includes('phone') || matchedBy.includes('USDOT number') || (named && !!city), matchedBy };
}

/** http(s) links in free text, cleaned of trailing punctuation. */
export function urlsIn(text: string): string[] {
  return [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)].map(x => x[0].replace(/[.,;:!?]+$/, '')))];
}
