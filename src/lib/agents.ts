/**
 * Agent network: established local moving companies that join Wont Stop
 * Moving as vetted agents across North America. An agent can be the origin
 * agent (packs and loads), the destination agent (delivers and unloads), the
 * long-distance hauler, or provide storage. Pure logic for unit tests.
 */

export const AGENT_SERVICES = ['Local moving', 'Long-distance moving', 'Packing', 'Storage / warehouse', 'Commercial / office', 'Auto transport', 'International', 'Labor only', 'Junk removal', 'Cleaning'] as const;
export const AGENT_ROLES = { origin: 'Origin agent (pack & load)', destination: 'Destination agent (deliver & unload)', hauling: 'Long-distance hauling', storage: 'Storage' } as const;
export type AgentRole = keyof typeof AGENT_ROLES;
export const AGENT_AGREEMENT_VERSION = '2026-11-11';

export const VETTING_CHECKS = {
  authority: 'Operating authority verified (USDOT/MC in FMCSA, or provincial/federal registration)',
  insurance: 'Insurance certificate received and current (cargo and liability)',
  references: 'Two customer or partner references checked',
  reviews: 'Online reviews checked (no unresolved pattern of complaints)',
  facility: 'Warehouse / office confirmed (photos or visit)',
} as const;
export type VettingKey = keyof typeof VETTING_CHECKS;

export const PROSPECT_STAGES = ['prospect', 'contacted', 'interested', 'applied', 'joined', 'declined'] as const;
export type ProspectStage = typeof PROSPECT_STAGES[number];

export type AgentApplication = {
  companyName: string; contactName: string; phone: string; website: string; country: Country;
  address: string; city: string; region: string; postalCode: string;
  usdot: string; mcNumber: string; otherAuthority: string; yearsInBusiness: number;
  trucks: number; tractors: number; warehouseSqft: number; employees: number;
  services: string[]; roles: AgentRole[]; serviceRegions: string[];
  insuranceCarrier: string; cargoCoverageUsd: number; about: string; agreementAccepted: boolean;
};

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const int = (v: unknown, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

/** Validates an application from a form or request. Returns the clean data or the first problem. */
export function checkAgentApplication(raw: Record<string, unknown>): { ok: true; data: AgentApplication } | { ok: false; error: string } {
  const country = (['US', 'CA', 'MX'] as const).find(c => c === raw.country);
  const region = s(raw.region, 10);
  const data: AgentApplication = {
    companyName: s(raw.companyName, 160), contactName: s(raw.contactName, 120), phone: s(raw.phone, 30), website: s(raw.website, 300),
    country: country || 'US', address: s(raw.address, 200), city: s(raw.city, 80), region, postalCode: s(raw.postalCode, 12),
    usdot: s(raw.usdot, 12).replace(/\D/g, ''), mcNumber: s(raw.mcNumber, 12).replace(/\D/g, ''), otherAuthority: s(raw.otherAuthority, 200),
    yearsInBusiness: int(raw.yearsInBusiness, 200), trucks: int(raw.trucks, 100000), tractors: int(raw.tractors, 100000),
    warehouseSqft: int(raw.warehouseSqft, 100_000_000), employees: int(raw.employees, 1_000_000),
    services: Array.isArray(raw.services) ? [...new Set(raw.services.filter((x): x is string => (AGENT_SERVICES as readonly string[]).includes(x as string)))] : [],
    roles: Array.isArray(raw.roles) ? [...new Set(raw.roles.filter((x): x is AgentRole => typeof x === 'string' && x in AGENT_ROLES))] : [],
    serviceRegions: Array.isArray(raw.serviceRegions) ? [...new Set(raw.serviceRegions.filter((x): x is string => typeof x === 'string' && REGION_BY_CODE.has(x)))].slice(0, 100) : [],
    insuranceCarrier: s(raw.insuranceCarrier, 120), cargoCoverageUsd: int(raw.cargoCoverageUsd, 1e9), about: s(raw.about, 3000), agreementAccepted: raw.agreementAccepted === true,
  };
  if (!country) return { ok: false, error: 'Choose your country.' };
  if (data.companyName.length < 2) return { ok: false, error: 'Enter your company name.' };
  if (data.contactName.length < 2) return { ok: false, error: 'Enter a contact name.' };
  if (data.phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Enter a phone number.' };
  if (data.address.length < 5 || data.city.length < 2) return { ok: false, error: 'Enter your business address.' };
  if (REGION_BY_CODE.get(region)?.country !== country) return { ok: false, error: 'Choose your state or province.' };
  if (country === 'US' && !data.usdot) return { ok: false, error: 'US agents need a USDOT number.' };
  if (country !== 'US' && !data.otherAuthority && !data.usdot) return { ok: false, error: 'Enter your operating authority or registration number.' };
  if (data.trucks < 1) return { ok: false, error: 'Agents need at least one truck.' };
  if (!data.services.length) return { ok: false, error: 'Choose the services you offer.' };
  if (!data.roles.length) return { ok: false, error: 'Choose how you want to work with the network.' };
  if (!data.serviceRegions.length) return { ok: false, error: 'Choose the states or provinces you serve.' };
  if (!data.insuranceCarrier) return { ok: false, error: 'Enter your insurance carrier.' };
  if (!data.agreementAccepted) return { ok: false, error: 'Accept the agent agreement to apply.' };
  return { ok: true, data };
}

export type CoverageAgent = { status: string; serviceRegions?: string[]; trucks?: number; warehouseSqft?: number; roles?: string[] };

/** Approved agents, trucks and warehouse space per state/province, plus regions with nobody. */
export function networkCoverage(agents: CoverageAgent[]) {
  const by = new Map(REGIONS.map(r => [r.code, { ...r, agents: 0, trucks: 0, warehouseSqft: 0, origin: 0, destination: 0 }]));
  for (const a of agents) {
    if (a.status !== 'approved') continue;
    for (const code of a.serviceRegions || []) {
      const r = by.get(code);
      if (!r) continue;
      r.agents++; r.trucks += a.trucks || 0; r.warehouseSqft += a.warehouseSqft || 0;
      if (a.roles?.includes('origin')) r.origin++;
      if (a.roles?.includes('destination')) r.destination++;
    }
  }
  const regions = [...by.values()];
  return { regions, covered: regions.filter(r => r.agents > 0).length, gaps: regions.filter(r => r.agents === 0) };
}

// ---- North American regions: US states (+DC), Canadian provinces and territories, Mexican states.
export type Country = 'US' | 'CA' | 'MX';
export type Region = { code: string; name: string; country: Country };

const US = 'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming';
const CA = 'AB Alberta|BC British Columbia|MB Manitoba|NB New Brunswick|NL Newfoundland and Labrador|NS Nova Scotia|NT Northwest Territories|NU Nunavut|ON Ontario|PE Prince Edward Island|QC Quebec|SK Saskatchewan|YT Yukon';
const MX = 'AGU Aguascalientes|BCN Baja California|BCS Baja California Sur|CAM Campeche|CHP Chiapas|CHH Chihuahua|CMX Mexico City|COA Coahuila|COL Colima|DUR Durango|GUA Guanajuato|GRO Guerrero|HID Hidalgo|JAL Jalisco|MEX State of Mexico|MIC Michoacán|MOR Morelos|NAY Nayarit|NLE Nuevo León|OAX Oaxaca|PUE Puebla|QUE Querétaro|ROO Quintana Roo|SLP San Luis Potosí|SIN Sinaloa|SON Sonora|TAB Tabasco|TAM Tamaulipas|TLA Tlaxcala|VER Veracruz|YUC Yucatán|ZAC Zacatecas';

const parse = (s: string, country: Country): Region[] => s.split('|').map(x => { const i = x.indexOf(' '); return { code: `${country}-${x.slice(0, i)}`, name: x.slice(i + 1), country }; });
export const REGIONS: Region[] = [...parse(US, 'US'), ...parse(CA, 'CA'), ...parse(MX, 'MX')];
export const REGION_BY_CODE = new Map(REGIONS.map(r => [r.code, r]));
export const COUNTRY_NAMES: Record<Country, string> = { US: 'United States', CA: 'Canada', MX: 'Mexico' };
