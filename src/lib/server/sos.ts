/**
 * Secretary of State (business registry) lookups. Five states publish their
 * registries as free open-data APIs, which we query by company name:
 * Colorado, Connecticut, New York, Oregon and Texas. Everywhere else we link
 * to the state's own search page instead of scraping it.
 */
export type SosRecord = { state: string; name: string; status: string; active: boolean | null; entityType: string; formed: string; agent: string; agentAddress: string; id: string; source: string; url: string | null };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const day = (v: unknown) => s(v).slice(0, 10);
const esc = (v: string) => v.replace(/'/g, "''").toUpperCase();

async function soda<T>(host: string, id: string, where: string, limit = 5): Promise<T[]> {
  const qs = new URLSearchParams({ $where: where, $limit: String(limit) });
  const res = await fetch(`https://${host}/resource/${id}.json?${qs}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${host} answered ${res.status}`);
  return res.json() as Promise<T[]>;
}

/** Strips punctuation and entity suffixes so "ACME MOVING, INC." matches "Acme Moving Inc". */
export const nameKey = (n: string) => n.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(INC|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP|PC|PLLC)\b/g, ' ').replace(/\s+/g, ' ').trim();

const ADAPTERS: Record<string, (name: string) => Promise<SosRecord[]>> = {
  CO: async name => (await soda<Record<string, string>>('data.colorado.gov', '4ykn-tg5h', `upper(entityname) like '${esc(name)}%'`)).map(r => ({
    state: 'CO', name: s(r.entityname), status: s(r.entitystatus), active: /good standing|exists/i.test(s(r.entitystatus)), entityType: s(r.entitytype), formed: day(r.entityformdate),
    agent: [r.agentfirstname, r.agentmiddlename, r.agentlastname, r.agentorganizationname].map(s).filter(Boolean).join(' '), agentAddress: [r.agentprincipaladdress1, r.agentprincipalcity, r.agentprincipalstate, r.agentprincipalzipcode].map(s).filter(Boolean).join(', '),
    id: s(r.entityid), source: 'Colorado Secretary of State (open data)', url: null,
  })),
  NY: async name => (await soda<Record<string, string>>('data.ny.gov', 'n9v6-gdp6', `upper(current_entity_name) like '${esc(name)}%'`)).map(r => ({
    state: 'NY', name: s(r.current_entity_name), status: 'Active', active: true, entityType: s(r.entity_type), formed: day(r.initial_dos_filing_date),
    agent: s(r.dos_process_name), agentAddress: [r.dos_process_address_1, r.dos_process_city, r.dos_process_state, r.dos_process_zip].map(s).filter(Boolean).join(', '),
    id: s(r.dos_id), source: 'New York Department of State: active corporations (open data)', url: null,
  })),
  OR: async name => {
    const rows = await soda<Record<string, any>>('data.oregon.gov', 'tckn-sxa6', `upper(business_name) like '${esc(name)}%'`, 20);
    const byReg = new Map<string, Record<string, any>[]>();
    for (const r of rows) byReg.set(s(r.registry_number), [...(byReg.get(s(r.registry_number)) || []), r]);
    return [...byReg.entries()].map(([id, rs]) => {
      const agent = rs.find(r => r.associated_name_type === 'REGISTERED AGENT');
      return {
        state: 'OR', name: s(rs[0].business_name), status: 'Active', active: true, entityType: s(rs[0].entity_type), formed: day(rs[0].registry_date),
        agent: agent ? [agent.first_name, agent.middle_name, agent.last_name, agent.entity_of_record_name].map(s).filter(Boolean).join(' ') : '',
        agentAddress: agent ? [agent.address, agent.city, agent.state, agent.zip].map(s).filter(Boolean).join(', ') : '',
        id, source: 'Oregon Secretary of State: active businesses (open data)', url: rs[0].business_details?.url || null,
      };
    });
  },
  CT: async name => {
    const rows = await soda<Record<string, string>>('data.ct.gov', 'n7gp-d28j', `upper(name) like '${esc(name)}%'`);
    return Promise.all(rows.map(async r => {
      const agents = await soda<Record<string, string>>('data.ct.gov', 'qh2m-n44y', `business_key='${s(r.id).replace(/'/g, '')}'`, 1).catch(() => []);
      return {
        state: 'CT', name: s(r.name), status: s(r.status), active: /active/i.test(s(r.status)), entityType: s((r as any).business_type), formed: day(r.date_registration).startsWith('0001') ? '' : day(r.date_registration),
        agent: s(agents[0]?.name__c), agentAddress: s(agents[0]?.business_address), id: s(r.accountnumber), source: 'Connecticut Business Registry (open data)', url: null,
      };
    }));
  },
  TX: async name => (await soda<Record<string, string>>('data.texas.gov', '9cir-efmm', `upper(taxpayer_name) like '${esc(name)}%'`)).map(r => ({
    state: 'TX', name: s(r.taxpayer_name), status: r.right_to_transact_business_code === 'A' ? 'Active (right to transact business)' : `Not active (${s(r.right_to_transact_business_code) || 'unknown'})`,
    active: r.right_to_transact_business_code === 'A', entityType: s(r.taxpayer_organizational_type), formed: day(r.sos_charter_date),
    agent: '', agentAddress: '', id: s(r.secretary_of_state_sos_or_coa_file_number) || s(r.taxpayer_number), source: 'Texas Comptroller: active franchise taxpayers (open data)', url: null,
  })),
};

export const SOS_FREE_STATES = Object.keys(ADAPTERS);

/** Each state's own business search page, for states without free data. */
export const SOS_SEARCH: Record<string, string> = {
  CA: 'https://bizfileonline.sos.ca.gov/search/business', WA: 'https://ccfs.sos.wa.gov/#/BusinessSearch', FL: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName',
  NY: 'https://apps.dos.ny.gov/publicInquiry/', TX: 'https://mycpa.cpa.state.tx.us/coa/', CO: 'https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do',
  OR: 'https://sos.oregon.gov/business/Pages/find.aspx', CT: 'https://service.ct.gov/business/s/onlinebusinesssearch', GA: 'https://ecorp.sos.ga.gov/BusinessSearch',
  PA: 'https://file.dos.pa.gov/search/business', IL: 'https://apps.ilsos.gov/businessentitysearch/', NJ: 'https://www.njportal.com/DOR/BusinessNameSearch/',
  AZ: 'https://ecorp.azcc.gov/EntitySearch/Index', NV: 'https://esos.nv.gov/EntitySearch/OnlineEntitySearch', MA: 'https://corp.sec.state.ma.us/corpweb/corpsearch/CorpSearch.aspx',
};
export const sosSearchUrl = (state: string) => SOS_SEARCH[state] || `https://www.google.com/search?q=${encodeURIComponent(`${state} secretary of state business entity search`)}`;

/** Best registry match for a company, or null if this state has no free data. */
export async function lookupSos(state: string, names: string[]): Promise<{ matches: SosRecord[]; best: SosRecord | null } | null> {
  const adapter = ADAPTERS[state];
  if (!adapter) return null;
  const seen = new Set<string>(), matches: SosRecord[] = [];
  for (const n of names.filter(Boolean)) {
    const query = n.replace(/[^A-Za-z0-9 &'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (query.length < 3) continue;
    for (const r of await adapter(query)) { const k = `${r.id}:${r.name}`; if (!seen.has(k)) { seen.add(k); matches.push(r); } }
  }
  const wanted = names.map(nameKey);
  const best = matches.find(m => wanted.includes(nameKey(m.name))) || matches.find(m => m.active) || matches[0] || null;
  return { matches: matches.slice(0, 8), best };
}
