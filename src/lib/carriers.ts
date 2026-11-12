/**
 * Every for-hire carrier in the FMCSA Company Census, not just movers,
 * sorted into service categories from the cargo boxes each company ticks on
 * its federal filing. Freight haulers, car carriers and the rest are other
 * industries, but they're future partners and agents (hauling, overflow,
 * storage), so the registry keeps them on the map in their own sections.
 *
 * Pure logic (type imports only), so the import script (run outside the app)
 * and the app share it, and it can be unit-tested directly.
 */

import type { Mover, MoverFilters } from './registry';

export const CATEGORIES = [
  { key: 'household', label: 'Moving companies (household goods)', cargo: ['crgo_household'], partner: true },
  { key: 'freight', label: 'General freight', cargo: ['crgo_genfreight', 'crgo_paperprod'], partner: true },
  { key: 'auto', label: 'Car carriers & towing', cargo: ['crgo_motoveh', 'crgo_drivetow'], partner: true },
  { key: 'mobilehome', label: 'Mobile & modular homes', cargo: ['crgo_mobilehome'], partner: true },
  { key: 'intermodal', label: 'Containers & intermodal', cargo: ['crgo_intermodal'], partner: true },
  { key: 'mail', label: 'Mail & parcels', cargo: ['crgo_usmail'], partner: true },
  { key: 'construction', label: 'Construction & heavy haul', cargo: ['crgo_bldgmat', 'crgo_construct', 'crgo_machlrg', 'crgo_metalsheet', 'crgo_logpole', 'crgo_waterwell'], partner: false },
  { key: 'food', label: 'Food & refrigerated', cargo: ['crgo_produce', 'crgo_meat', 'crgo_coldfood', 'crgo_beverages'], partner: false },
  { key: 'farm', label: 'Farm & bulk', cargo: ['crgo_grainfeed', 'crgo_farmsupp', 'crgo_livestock', 'crgo_drybulk', 'crgo_coalcoke'], partner: false },
  { key: 'hazmat', label: 'Fuel, chemicals & hazmat', cargo: ['crgo_liqgas', 'crgo_chem', 'crgo_oilfield'], partner: false },
  { key: 'waste', label: 'Waste & utilities', cargo: ['crgo_garbage', 'crgo_utility'], partner: false },
  { key: 'other', label: 'Other cargo', cargo: ['crgo_cargoothr'], partner: false },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key) as CategoryKey[];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label])) as Record<CategoryKey, string>;
const BIT = Object.fromEntries(CATEGORIES.map((c, i) => [c.key, 1 << i])) as Record<CategoryKey, number>;

export type CensusLike = Record<string, string | undefined>;

/** Bitmask of the categories a census row belongs to (lower-case column names). */
export function categoryBits(r: CensusLike): number {
  let bits = 0;
  for (const c of CATEGORIES) if (c.cargo.some(k => r[k] === 'X')) bits |= BIT[c.key];
  if (String(r.hm_ind || '').toUpperCase() === 'Y') bits |= BIT.hazmat;
  return bits;
}
export const hasCategory = (bits: number, key: CategoryKey) => (bits & BIT[key]) !== 0;
export const categoriesOf = (bits: number): CategoryKey[] => CATEGORY_KEYS.filter(k => hasCategory(bits, k));

/**
 * Which carriers the registry keeps: active companies that haul for hire
 * (authorized or exempt). Left out as irrelevant: private fleets hauling
 * their own goods (a plumber's trucks, a grocery chain's fleet), passenger
 * carriers (buses, limos, school buses), and inactive or pending records.
 */
export function keepCarrier(r: CensusLike): boolean {
  if (r.status_code !== 'A') return false;
  if (!/FOR HIRE/.test(String(r.classdef || '').toUpperCase())) return false;
  const bits = categoryBits(r);
  if (!bits && r.crgo_passengers === 'X') return false; // Passenger-only.
  return true;
}

/**
 * One carrier, compact (a tuple, to keep big states small in memory).
 * The state comes from the file; the map position from the ZIP.
 */
export type CarrierTuple = [
  dot: string, name: string, dba: string, city: string, zip: string, county: string,
  phone: string, email: string, units: number, drivers: number, miles: number, added: string,
  flags: number, cats: number, mc: string, otherCargo: string,
];
export const FLAG = { interstate: 1, hhgAuth: 2, authActive: 4, broker: 8 } as const;
export type Authority = { mc: string; hhg: boolean; active: boolean; broker: boolean };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const clean = (v: unknown) => String(v || '').trim().replace(/\s+/g, ' ');

export function toCarrierTuple(r: CensusLike, auth?: Authority): CarrierTuple {
  const rawZip = clean(r.phy_zip).toUpperCase();
  const zip = /^[A-Z]\d[A-Z]/.test(rawZip) ? rawZip.replace(/\s+/g, '').replace(/^(.{3})(.+)$/, '$1 $2') : rawZip.slice(0, 5);
  const units = num(r.power_units), drivers = num(r.total_drivers);
  const flags = (r.carrier_operation === 'A' ? FLAG.interstate : 0) | (auth?.hhg ? FLAG.hhgAuth : 0) | (auth?.active ? FLAG.authActive : 0) | (auth?.broker ? FLAG.broker : 0);
  return [
    String(Number(r.dot_number || 0)), clean(r.legal_name), clean(r.dba_name), clean(r.phy_city), zip, clean(r.phy_cnty),
    clean(r.phone).replace(/\D/g, '').slice(-10), clean(r.email_address).toLowerCase(),
    units > 500 && units > Math.max(drivers, 1) * 10 ? Math.max(drivers, 1) : units, drivers, num(r.mcs150_mileage), clean(r.add_date),
    flags, categoryBits(r), auth?.mc || '', clean(r.crgo_cargoothr_desc).slice(0, 60),
  ];
}

/** FMCSA operating authority, several dockets per carrier: keep the household-goods / active one. */
export function preferAuthority(prev: Authority | undefined, next: Authority): Authority {
  if (!prev || (next.hhg && !prev.hhg) || (next.active && !prev.active)) return next;
  return prev;
}

/**
 * The refresh schedule: every day for the first three imports, then weekly.
 * `prev` is the last import's manifest (null before the first one).
 */
export function importDue(prev: { runs?: number; generatedAt?: string } | null, now = Date.now()): { due: boolean; reason: string } {
  if (!prev?.generatedAt) return { due: true, reason: 'first import' };
  const age = now - Date.parse(prev.generatedAt), hours = age / 3600_000;
  if ((prev.runs || 0) < 3) return hours >= 20 ? { due: true, reason: `daily import ${(prev.runs || 0) + 1} of 3` } : { due: false, reason: 'already imported today' };
  return hours >= 6.5 * 24 ? { due: true, reason: 'weekly import' } : { due: false, reason: `weekly: next in ${Math.ceil((7 * 24 - hours) / 24)} day(s)` };
}

/** Columns the importer reads; a census file missing any of these is rejected. */
export const REQUIRED_COLUMNS = [
  'status_code', 'dot_number', 'classdef', 'carrier_operation', 'legal_name', 'dba_name', 'phy_street', 'phy_city', 'phy_state', 'phy_zip', 'phy_cnty', 'phy_country',
  'phone', 'cell_phone', 'email_address', 'company_officer_1', 'business_org_desc', 'power_units', 'truck_units', 'total_drivers', 'total_cdl',
  'mcs150_mileage', 'mcs150_mileage_year', 'add_date', 'mcs150_date', 'safety_rating', 'hm_ind', 'crgo_household', 'crgo_genfreight', 'crgo_cargoothr_desc',
];

/** Census columns as of the Rev08 data dictionary (2026-01-23), lower-case; used to flag added or removed columns. */
export const KNOWN_COLUMNS = 'mcs150_date,add_date,status_code,dot_number,dun_bradstreet_no,phy_omc_region,safety_inv_terr,carrier_operation,business_org_id,mcs150_mileage,mcs150_mileage_year,mcs151_mileage,total_cars,mcs150_update_code_id,prior_revoke_flag,prior_revoke_dot_number,phone,fax,cell_phone,company_officer_1,company_officer_2,business_org_desc,truck_units,power_units,bus_units,fleetsize,review_id,recordable_crash_rate,mail_nationality_indicator,phy_nationality_indicator,phy_barrio,mail_barrio,carship,docket1prefix,docket1,docket2prefix,docket2,docket3prefix,docket3,pointnum,total_intrastate_drivers,mcsipstep,mcsipdate,hm_ind,interstate_beyond_100_miles,interstate_within_100_miles,intrastate_beyond_100_miles,intrastate_within_100_miles,total_cdl,total_drivers,avg_drivers_leased_per_month,classdef,legal_name,dba_name,phy_street,phy_city,phy_country,phy_state,phy_zip,phy_cnty,carrier_mailing_street,carrier_mailing_state,carrier_mailing_city,carrier_mailing_country,carrier_mailing_zip,carrier_mailing_cnty,carrier_mailing_und_date,driver_inter_total,email_address,review_type,review_date,safety_rating,safety_rating_date,undeliv_phy,crgo_genfreight,crgo_household,crgo_metalsheet,crgo_motoveh,crgo_drivetow,crgo_logpole,crgo_bldgmat,crgo_mobilehome,crgo_machlrg,crgo_produce,crgo_liqgas,crgo_intermodal,crgo_passengers,crgo_oilfield,crgo_livestock,crgo_grainfeed,crgo_coalcoke,crgo_meat,crgo_garbage,crgo_usmail,crgo_chem,crgo_drybulk,crgo_coldfood,crgo_beverages,crgo_paperprod,crgo_utility,crgo_farmsupp,crgo_construct,crgo_waterwell,crgo_cargoothr,crgo_cargoothr_desc,owntruck,owntract,owntrail,owncoach,ownschool_1_8,ownschool_9_15,ownschool_16,ownbus_16,ownvan_1_8,ownvan_9_15,ownlimo_1_8,ownlimo_9_15,ownlimo_16,trmtruck,trmtract,trmtrail,trmcoach,trmschool_1_8,trmschool_9_15,trmschool_16,trmbus_16,trmvan_1_8,trmvan_9_15,trmlimo_1_8,trmlimo_9_15,trmlimo_16,trptruck,trptract,trptrail,trpcoach,trpschool_1_8,trpschool_9_15,trpschool_16,trpbus_16,trpvan_1_8,trpvan_9_15,trplimo_1_8,trplimo_9_15,trplimo_16,docket1_status_code,docket2_status_code,docket3_status_code'.split(',');

export function columnChanges(header: string[]) {
  const have = new Set(header.map(h => h.toLowerCase())), known = new Set(KNOWN_COLUMNS);
  return { added: [...have].filter(c => !known.has(c)), removed: KNOWN_COLUMNS.filter(c => !have.has(c)), missingRequired: REQUIRED_COLUMNS.filter(c => !have.has(c)) };
}

/** A carrier tuple as a registry row, so carriers share the movers' list, map, filters and export. */
export function tupleToMover(t: CarrierTuple, state: string, ll: [number, number] | null): Mover {
  const [dot, name, dba, city, zip, county, phone, email, units, drivers, miles, added, flags, cats, mc, otherCargo] = t;
  const site = siteOf(email);
  return {
    dot, name, dba, street: '', city, state, zip, county, phone, cell: '', email, site, officer: '', org: '',
    units, unitsReported: units, trucks: units, drivers, cdl: 0, miles, milesYear: 0,
    added: /^\d{8}$/.test(added) ? `${added.slice(0, 4)}-${added.slice(4, 6)}-${added.slice(6, 8)}` : '', updated: '',
    interstate: (flags & FLAG.interstate) !== 0, forHire: true, safety: '', cargoTypes: categoriesOf(cats).length,
    mc, hhgAuth: (flags & FLAG.hhgAuth) !== 0, authActive: (flags & FLAG.authActive) !== 0, broker: (flags & FLAG.broker) !== 0,
    lat: ll ? ll[0] : null, lng: ll ? ll[1] : null, moverScore: 0, likelyMover: false, cats, otherCargo,
  };
}

/** "General freight; Car carriers & towing" for a registry row (movers: household goods). */
export const servicesLabel = (m: Pick<Mover, 'cats' | 'otherCargo'>) => (m.cats ? [...categoriesOf(m.cats).map(k => CATEGORY_LABEL[k]), m.otherCargo].filter(Boolean).join('; ') : 'Household goods');

/**
 * Filters carrier tuples without turning them into full rows first (big
 * states hold hundreds of thousands): returns the matches with their map
 * position, ready to sort and page.
 */
export type LocatedCarrier = { t: CarrierTuple; lat: number | null; lng: number | null };
export function filterCarriers(
  tuples: CarrierTuple[],
  f: Pick<MoverFilters, 'q' | 'city' | 'zip' | 'bbox' | 'near' | 'minUnits' | 'maxUnits' | 'minDrivers' | 'minYears' | 'maxYears' | 'addedSince' | 'interstate' | 'hhgAuth' | 'hasEmail' | 'hasSite' | 'noSite'> & { counties?: string[] },
  zipLatLng: (zip: string) => [number, number] | null, now = Date.now(),
): LocatedCarrier[] {
  const q = (f.q || '').trim().toUpperCase(), city = (f.city || '').trim().toUpperCase();
  const added = f.addedSince ? f.addedSince.replace(/-/g, '') : '';
  const yearsOf = (a: string) => (/^\d{8}$/.test(a) ? Math.floor((now - Date.parse(`${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}T00:00:00Z`)) / (365.25 * 86400000)) : null);
  const out: LocatedCarrier[] = [];
  for (const t of tuples) {
    if (f.counties && !f.counties.includes(t[5])) continue;
    if (q && !`${t[1]} ${t[2]} ${t[0]} ${t[14]}`.toUpperCase().includes(q)) continue;
    if (city && t[3].toUpperCase() !== city) continue;
    if (f.zip && !t[4].startsWith(f.zip)) continue;
    if (f.minUnits !== undefined && t[8] < f.minUnits) continue;
    if (f.maxUnits !== undefined && t[8] > f.maxUnits) continue;
    if (f.minDrivers !== undefined && t[9] < f.minDrivers) continue;
    if (f.minYears !== undefined && (yearsOf(t[11]) ?? -1) < f.minYears) continue;
    if (f.maxYears !== undefined) { const y = yearsOf(t[11]); if (y === null || y > f.maxYears) continue; }
    if (added && (!t[11] || t[11] < added)) continue;
    if (f.interstate === 'yes' && !(t[12] & FLAG.interstate)) continue;
    if (f.interstate === 'no' && t[12] & FLAG.interstate) continue;
    if (f.hhgAuth && !(t[12] & FLAG.hhgAuth)) continue;
    if (f.hasEmail && !t[7]) continue;
    if ((f.hasSite || f.noSite) && !!siteOf(t[7]) !== !!f.hasSite) continue;
    const ll = zipLatLng(/^[A-Z]\d[A-Z]/.test(t[4]) ? t[4].slice(0, 3) : t[4]);
    const lat = ll ? ll[0] : null, lng = ll ? ll[1] : null;
    if (f.bbox && (lat === null || lng === null || lat < f.bbox.south || lat > f.bbox.north || lng < f.bbox.west || lng > f.bbox.east)) continue;
    if (f.near && (lat === null || lng === null || milesBetween(f.near.lat, f.near.lng, lat, lng) > f.near.miles)) continue;
    out.push({ t, lat, lng });
  }
  return out;
}

export function sortCarriers(rows: LocatedCarrier[], key: string, near?: { lat: number; lng: number }): LocatedCarrier[] {
  const size = (t: CarrierTuple) => t[8] * 10 + t[9] * 4 + Math.min(t[10], 50_000_000) / 25_000;
  const cmp: Record<string, (a: LocatedCarrier, b: LocatedCarrier) => number> = {
    size: (a, b) => size(b.t) - size(a.t), units: (a, b) => b.t[8] - a.t[8] || b.t[9] - a.t[9], drivers: (a, b) => b.t[9] - a.t[9] || b.t[8] - a.t[8], miles: (a, b) => b.t[10] - a.t[10],
    years: (a, b) => (a.t[11] || '99999999').localeCompare(b.t[11] || '99999999'), newest: (a, b) => (b.t[11] || '').localeCompare(a.t[11] || ''),
    name: (a, b) => (a.t[2] || a.t[1]).localeCompare(b.t[2] || b.t[1]),
    distance: (a, b) => (near && a.lat !== null && b.lat !== null && a.lng !== null && b.lng !== null ? milesBetween(near.lat, near.lng, a.lat, a.lng) - milesBetween(near.lat, near.lng, b.lat, b.lng) : 0),
  };
  const by = cmp[key] || cmp.size;
  return rows.sort((a, b) => by(a, b) || a.t[0].localeCompare(b.t[0]));
}

const FREE_MAIL = /(^|\.)(gmail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|comcast|att|sbcglobal|verizon|cox|charter|earthlink|protonmail|proton|gmx|mail|zoho|yandex|bellsouth|frontier|optonline|q|qq|163)\.[a-z.]+$/i;
function siteOf(email: string) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  return domain && !FREE_MAIL.test(domain) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? `https://${domain}` : '';
}
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
