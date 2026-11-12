/**
 * The national mover registry: every active U.S. carrier that hauls
 * household goods, from the free FMCSA Company Census (updated daily by the
 * U.S. DOT), joined with FMCSA operating authority. Pure logic (no imports)
 * so filtering, scoring and ranking can be unit-tested directly.
 */

export type Mover = {
  dot: string; name: string; dba: string;
  street: string; city: string; state: string; zip: string; county: string; // county = 3-digit FIPS
  phone: string; cell: string; email: string; site: string; officer: string; org: string;
  units: number; unitsReported: number; trucks: number; drivers: number; cdl: number; miles: number; milesYear: number;
  added: string; updated: string; // YYYY-MM-DD
  interstate: boolean; forHire: boolean; safety: string; cargoTypes: number;
  mc: string; hhgAuth: boolean; authActive: boolean; broker: boolean;
  lat: number | null; lng: number | null;
  moverScore: number; likelyMover: boolean;
  cats?: number; otherCargo?: string; // Service categories (bitmask, src/lib/carriers.ts), on non-mover carriers.
  partnerScore?: number; partnerReasons?: string[]; // Partner candidates only (src/lib/carriers.ts partnerScore).
};

const FREE_MAIL = /(^|\.)(gmail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|comcast|att|sbcglobal|verizon|cox|charter|earthlink|protonmail|proton|gmx|mail|zoho|yandex|bellsouth|frontier|optonline|q|qq|163)\.[a-z.]+$/i;
const MOVER_WORDS = /\b(MOV(E|ER|ERS|ING)|VAN ?LINES?|RELOCAT\w*|STORAGE|TRANSFER|HAUL\w*|TWO MEN|MEN AND|LABOR|PIANO|ESTATE)\b/;
const NOT_MOVER_WORDS = /\b(TOWING|TOW|AUTO TRANSPORT|CAR CARRIER|LOGISTICS INC|FREIGHT|TANKER|PETROLEUM|CONSTRUCTION|EXCAVAT\w*|CONCRETE|AGGREGATE|FARMS?|DAIRY|MEDIA|UNIVERSITY|SCHOOL|CHURCH|COUNTY|CITY OF|STATE OF|HOSPITAL|AIRLINES?)\b/;

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const ymd = (v: unknown) => { const s = String(v || ''); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : ''; };
const title = (v: unknown) => String(v || '').trim().replace(/\s+/g, ' ');

/** "info@acmemovers.com" → "https://acmemovers.com"; free mail providers → "". */
export function siteFromEmail(email: string): string {
  const domain = (email.split('@')[1] || '').toLowerCase().trim();
  if (!domain || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || FREE_MAIL.test(domain)) return '';
  return `https://${domain}`;
}

/**
 * 0-100: how likely a household-goods carrier is an actual moving company
 * (rather than, say, a studio or freight hauler that ticked the box).
 */
export function moverLikelihood(m: Pick<Mover, 'name' | 'dba' | 'forHire' | 'hhgAuth' | 'cargoTypes' | 'broker'>): number {
  const text = `${m.name} ${m.dba}`.toUpperCase();
  let s = 0;
  if (m.forHire) s += 25; else s -= 30;
  if (m.hhgAuth) s += 35;
  if (MOVER_WORDS.test(text)) s += 30;
  if (NOT_MOVER_WORDS.test(text)) s -= 35;
  if (m.cargoTypes <= 2) s += 15; else if (m.cargoTypes >= 6) s -= 15;
  return Math.max(0, Math.min(100, s));
}

/** Score needed to count as a moving company: household-goods authority or a mover-type name, plus for-hire. */
export const LIKELY_MOVER_SCORE = 50;

/**
 * Some filings have impossible fleet sizes (e.g. 50,061 trucks and 3 drivers).
 * Above 500 trucks with over 10 per driver, trust the driver count instead.
 */
export const saneUnits = (units: number, drivers: number) => (units > 500 && units > Math.max(drivers, 1) * 10 ? Math.max(drivers, 1) : units);

export type CensusRow = Record<string, string | undefined>;
export type AuthorityRow = { mc: string; hhg: boolean; active: boolean; broker: boolean };

/** One FMCSA census row (+ authority) → a registry entry. */
export function toMover(r: CensusRow, auth: AuthorityRow | undefined, zipLatLng: (zip: string) => [number, number] | null): Mover {
  // U.S. ZIP (first 5 digits) or Canadian postal code ("M5V 3L9", located by its first 3 characters).
  const rawZip = String(r.phy_zip || '').trim().toUpperCase();
  const canadian = /^[A-Z]\d[A-Z]/.test(rawZip);
  const zip = canadian ? rawZip.replace(/\s+/g, '').replace(/^(.{3})(.+)$/, '$1 $2') : rawZip.slice(0, 5);
  const ll = zipLatLng(canadian ? rawZip.slice(0, 3) : zip);
  const cargoTypes = Object.keys(r).filter(k => k.startsWith('crgo_') && k !== 'crgo_cargoothr_desc' && r[k] === 'X').length;
  const classdef = String(r.classdef || '').toUpperCase();
  const email = String(r.email_address || '').trim().toLowerCase();
  const base = {
    dot: String(Number(r.dot_number || 0)), name: title(r.legal_name), dba: title(r.dba_name),
    street: title(r.phy_street), city: title(r.phy_city), state: String(r.phy_state || '').toUpperCase(), zip, county: String(r.phy_cnty || ''),
    phone: String(r.phone || '').replace(/\D/g, '').slice(-10), cell: String(r.cell_phone || '').replace(/\D/g, '').slice(-10), email, site: siteFromEmail(email),
    officer: title(r.company_officer_1), org: title(r.business_org_desc),
    units: saneUnits(num(r.power_units), num(r.total_drivers)), unitsReported: num(r.power_units), trucks: num(r.truck_units), drivers: num(r.total_drivers), cdl: num(r.total_cdl), miles: num(r.mcs150_mileage), milesYear: num(r.mcs150_mileage_year),
    added: ymd(r.add_date), updated: ymd(r.mcs150_date),
    interstate: r.carrier_operation === 'A', forHire: /FOR HIRE/.test(classdef), safety: String(r.safety_rating || ''), cargoTypes,
    mc: auth?.mc || '', hhgAuth: !!auth?.hhg, authActive: !!auth?.active, broker: !!auth?.broker,
    lat: ll ? ll[0] : null, lng: ll ? ll[1] : null,
  };
  const moverScore = moverLikelihood(base);
  return { ...base, moverScore, likelyMover: moverScore >= LIKELY_MOVER_SCORE };
}

export const yearsInBusiness = (m: Pick<Mover, 'added'>, now = Date.now()) => (m.added ? Math.max(0, Math.floor((now - Date.parse(`${m.added}T00:00:00Z`)) / (365.25 * 86400000))) : 0);

/** Overall size, for "biggest" rankings: trucks first, then drivers, then miles. */
export const sizeScore = (m: Pick<Mover, 'units' | 'drivers' | 'miles'>) => m.units * 10 + m.drivers * 4 + Math.min(m.miles, 50_000_000) / 25_000;

export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180, R = 3958.8;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Region presets (hand-picked regions and every big metro) live in src/lib/regions.ts; filters take the resolved area.

export type SortKey = 'size' | 'units' | 'drivers' | 'miles' | 'years' | 'newest' | 'name' | 'distance' | 'score';
export type MoverFilters = {
  q?: string; states?: string[]; region?: string; city?: string; zip?: string;
  area?: { states: string[]; counties: string[] }; // The region preset, resolved (src/lib/regions.ts): counties as "ST-ccc".
  near?: { lat: number; lng: number; miles: number };
  bbox?: { south: number; west: number; north: number; east: number };
  minUnits?: number; maxUnits?: number; minDrivers?: number; minYears?: number; maxYears?: number; addedSince?: string;
  interstate?: 'yes' | 'no'; hhgAuth?: boolean; likelyOnly?: boolean; hasEmail?: boolean; hasSite?: boolean; noSite?: boolean;
  org?: string; dots?: Set<string>; excludeDots?: Set<string>;
};

/** Filters registry rows; pass `now` for stable "years in business" in tests. */
export function filterMovers(rows: Mover[], f: MoverFilters, now = Date.now()): Mover[] {
  const q = (f.q || '').trim().toUpperCase();
  const city = (f.city || '').trim().toUpperCase();
  return rows.filter(m => {
    if (f.likelyOnly !== false && !m.likelyMover) return false;
    if (f.area && !f.area.counties.includes(`${m.state}-${m.county}`)) return false;
    if (f.states?.length && !f.states.includes(m.state)) return false;
    if (q && !`${m.name} ${m.dba} ${m.dot} ${m.mc} ${m.officer}`.toUpperCase().includes(q)) return false;
    if (city && m.city.toUpperCase() !== city) return false;
    if (f.zip && !m.zip.startsWith(f.zip)) return false;
    if (f.bbox && (m.lat === null || m.lng === null || m.lat < f.bbox.south || m.lat > f.bbox.north || m.lng < f.bbox.west || m.lng > f.bbox.east)) return false;
    if (f.near && (m.lat === null || m.lng === null || distanceMiles(f.near.lat, f.near.lng, m.lat, m.lng) > f.near.miles)) return false;
    if (f.minUnits !== undefined && m.units < f.minUnits) return false;
    if (f.maxUnits !== undefined && m.units > f.maxUnits) return false;
    if (f.minDrivers !== undefined && m.drivers < f.minDrivers) return false;
    if (f.minYears !== undefined && yearsInBusiness(m, now) < f.minYears) return false;
    if (f.maxYears !== undefined && (!m.added || yearsInBusiness(m, now) > f.maxYears)) return false;
    if (f.addedSince && (!m.added || m.added < f.addedSince)) return false;
    if (f.interstate === 'yes' && !m.interstate) return false;
    if (f.interstate === 'no' && m.interstate) return false;
    if (f.hhgAuth && !m.hhgAuth) return false;
    if (f.hasEmail && !m.email) return false;
    if (f.hasSite && !m.site) return false;
    if (f.noSite && m.site) return false;
    if (f.org && !m.org.toUpperCase().includes(f.org.toUpperCase())) return false;
    if (f.dots && !f.dots.has(m.dot)) return false;
    if (f.excludeDots && f.excludeDots.has(m.dot)) return false;
    return true;
  });
}

export function sortMovers(rows: Mover[], key: SortKey = 'size', near?: { lat: number; lng: number }, now = Date.now()): Mover[] {
  const by: Record<SortKey, (a: Mover, b: Mover) => number> = {
    size: (a, b) => sizeScore(b) - sizeScore(a),
    units: (a, b) => b.units - a.units || b.drivers - a.drivers,
    drivers: (a, b) => b.drivers - a.drivers || b.units - a.units,
    miles: (a, b) => b.miles - a.miles,
    years: (a, b) => yearsInBusiness(b, now) - yearsInBusiness(a, now) || sizeScore(b) - sizeScore(a),
    newest: (a, b) => (b.added || '').localeCompare(a.added || ''),
    name: (a, b) => (a.dba || a.name).localeCompare(b.dba || b.name),
    distance: (a, b) => near && a.lat !== null && b.lat !== null && a.lng !== null && b.lng !== null
      ? distanceMiles(near.lat, near.lng, a.lat, a.lng) - distanceMiles(near.lat, near.lng, b.lat, b.lng) : 0,
    score: (a, b) => sizeScore(b) - sizeScore(a), // Partner fit applies to carriers only; movers fall back to size.
  };
  return [...rows].sort((a, b) => by[key](a, b) || a.dot.localeCompare(b.dot));
}

export type OurFleet = { units: number; drivers: number; miles: number; years: number };

/**
 * Where we'd rank among `rows` (already filtered) by `key`, and the
 * companies just above us: the next ones to pass.
 */
export function ourRank(rows: Mover[], us: OurFleet, key: 'size' | 'units' | 'drivers' | 'miles' = 'size', now = Date.now()) {
  const value = (m: Pick<Mover, 'units' | 'drivers' | 'miles'>) => (key === 'size' ? sizeScore(m) : m[key]);
  const ours = value(us);
  const ahead = rows.filter(m => value(m) > ours).sort((a, b) => value(a) - value(b));
  return { rank: ahead.length + 1, of: rows.length + 1, nextUp: ahead.slice(0, 5), gapTo: (m: Mover) => ({ units: Math.max(0, m.units - us.units + 1), drivers: Math.max(0, m.drivers - us.drivers + 1), years: Math.max(0, yearsInBusiness(m, now) - us.years) }) };
}

/** Comma-safe CSV of registry rows. */
export function moversCsv(rows: Mover[], now = Date.now(), services: (m: Mover) => string = () => 'Household goods'): string {
  const cols: [string, (m: Mover) => string | number][] = [
    ['DOT', m => m.dot], ['MC', m => m.mc], ['Legal name', m => m.name], ['DBA', m => m.dba], ['Street', m => m.street], ['City', m => m.city], ['State', m => m.state], ['ZIP', m => m.zip],
    ['Phone', m => m.phone], ['Email', m => m.email], ['Website (from email)', m => m.site], ['Officer', m => m.officer], ['Entity type', m => m.org],
    ['Power units', m => m.units], ['Trucks', m => m.trucks], ['Drivers', m => m.drivers], ['Miles/yr', m => m.miles], ['Years in business', m => yearsInBusiness(m, now)],
    ['Interstate', m => (m.interstate ? 'Yes' : 'No')], ['HHG authority', m => (m.hhgAuth ? 'Yes' : 'No')], ['Mover likelihood', m => m.moverScore],
    ['Services', m => services(m)],
  ];
  // The partner shortlist: its score and why.
  if (rows.some(m => m.partnerScore !== undefined)) cols.push(['Partner fit (0-100)', m => m.partnerScore ?? ''], ['Why', m => (m.partnerReasons || []).join('; ')]);
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.map(c => esc(c[0])).join(','), ...rows.map(m => cols.map(c => esc(c[1](m))).join(','))].join('\n');
}

/** Canadian provinces and territories (cross-border movers registered with FMCSA). */
export const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
export const isProvince = (code: string) => CA_PROVINCES.includes(code);

export const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

/** Every area the registry covers: U.S. states, DC, Puerto Rico and Canadian provinces. */
export const REGISTRY_AREAS = [...US_STATES, ...CA_PROVINCES];

// ---- Rank explanation (how the score works and what it takes to move up) ----

export const SIZE_WEIGHTS = { perTruck: 10, perDriver: 4, milesPerPoint: 25_000, milesCap: 50_000_000 } as const;

export function sizeParts(m: Pick<Mover, 'units' | 'drivers' | 'miles'>) {
  const trucks = m.units * SIZE_WEIGHTS.perTruck, drivers = m.drivers * SIZE_WEIGHTS.perDriver, miles = Math.min(m.miles, SIZE_WEIGHTS.milesCap) / SIZE_WEIGHTS.milesPerPoint;
  return { trucks, drivers, miles: Math.round(miles), total: Math.round(trucks + drivers + miles) };
}

export type UsProfile = OurFleet & { hasAuthority?: boolean; hasWebsite?: boolean };

/** Full, plain explanation of where we rank among `rows` and what moves us up. */
export function explainRank(rows: Mover[], us: UsProfile, now = Date.now()) {
  const ours = sizeParts(us);
  const ahead = rows.filter(m => sizeScore(m) > sizeScore(us)).sort((a, b) => sizeScore(a) - sizeScore(b));
  const need = (m: Mover) => { const pts = Math.max(1, Math.ceil(sizeScore(m) - sizeScore(us) + 0.01)); return { points: pts, trucks: Math.ceil(pts / SIZE_WEIGHTS.perTruck), drivers: Math.ceil(pts / SIZE_WEIGHTS.perDriver) }; };
  const measure = (label: string, ourValue: number, value: (m: Mover) => number, unit = '') => {
    const values = rows.map(value).sort((a, b) => b - a);
    return { label, ours: ourValue, rank: values.filter(v => v > ourValue).length + 1, of: rows.length + 1, leader: values[0] ?? 0, median: values.length ? values[Math.floor(values.length / 2)] : 0, unit };
  };
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0);
  const authorityShare = pct(rows.filter(m => m.hhgAuth).length), websiteShare = pct(rows.filter(m => m.site).length);
  const sorted = [...rows].sort((a, b) => sizeScore(b) - sizeScore(a));
  const tenth = sorted[Math.min(9, sorted.length - 1)];
  const steps: string[] = [];
  if (!us.units && !us.drivers) steps.push('Enter your trucks and drivers (count your providers’ and agents’ fleets as your network) under Competitors → Our numbers. Until then you’re ranked as if you had none.');
  if (ahead[0]) { const n = need(ahead[0]); steps.push(`Pass ${ahead[0].dba || ahead[0].name}, the next company up: add ${n.trucks} truck${n.trucks === 1 ? '' : 's'} or ${n.drivers} driver${n.drivers === 1 ? '' : 's'} (or a mix worth ${n.points} points).`); }
  if (tenth && sizeScore(tenth) > sizeScore(us)) { const n = need(tenth); steps.push(`Reach the top 10 here: about ${n.trucks} more truck${n.trucks === 1 ? '' : 's'} (or ${n.drivers} more drivers).`); }
  if (!us.hasAuthority) steps.push(`Get your USDOT number and household-goods authority: ${authorityShare}% of movers here have it, and the registry can only rank you on real data once you’re in it.`);
  if (!us.hasWebsite) steps.push(`Make sure your website is on your federal filing: ${websiteShare}% of movers here show one.`);
  steps.push('Size isn’t everything: reviews, response time and repeat customers are tracked per competitor under Competitors, where you “pass” a company by beating it on every number you both have.');
  return {
    formula: `Score = trucks × ${SIZE_WEIGHTS.perTruck} + drivers × ${SIZE_WEIGHTS.perDriver} + yearly miles ÷ ${SIZE_WEIGHTS.milesPerPoint.toLocaleString()}`,
    ours, rank: ahead.length + 1, of: rows.length + 1,
    nextUp: ahead.slice(0, 5).map(m => ({ dot: m.dot, name: m.dba || m.name, city: m.city, state: m.state, units: m.units, drivers: m.drivers, years: yearsInBusiness(m, now), score: sizeParts(m), need: need(m) })),
    measures: [
      measure('Trucks', us.units, m => m.units),
      measure('Drivers', us.drivers, m => m.drivers),
      measure('Years in business', us.years, m => yearsInBusiness(m, now), 'yrs'),
    ],
    shares: { authority: authorityShare, website: websiteShare },
    steps,
  };
}
