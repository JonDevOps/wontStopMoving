import type { Mover } from '@/lib/registry';

/**
 * Jev (typesafe.ai): a fast, low-cost "System One" model that answers typed
 * questions about data we give it. We use it to sort registry companies;
 * it doesn't browse or look anything up itself.
 * Key: the TYPESAFE_API_KEY App Hosting secret.
 */
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

type ChoiceAnswer = { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> };

export const jevConfigured = () => !!process.env.TYPESAFE_API_KEY;

async function ask(state: string, questions: Record<string, { type: 'choice'; instructions: string; criteria: Record<string, string> }>) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('Jev is not configured (TYPESAFE_API_KEY).');
  const res = await fetch(ENDPOINT, {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.JEV_MODEL || 'jev-latest', state, questions }),
  });
  if (!res.ok) throw new Error(`Jev answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { model: string; answers: Record<string, ChoiceAnswer> };
  return data;
}

export const KINDS = {
  local_mover: 'Local or regional moving company: moves households and offices for customers',
  van_line: 'National van line brand or a van line agent (Allied, Atlas, United, Mayflower, North American, Bekins, Wheaton, Arpin, Graebel, Two Men and a Truck and similar)',
  broker: 'Moving broker or lead seller that arranges moves but does not do them with its own crews',
  freight: 'General freight, trucking, delivery or logistics carrier that is not mainly a household mover',
  other: 'Not a mover for customers: towing, construction, a school, studio, government or a private fleet',
} as const;
export type MoverKind = keyof typeof KINDS;

export async function classifyMover(m: Mover): Promise<{ kind: MoverKind; confidence: number; probabilities: Record<string, number>; model: string }> {
  const state = JSON.stringify({
    legal_name: m.name, doing_business_as: m.dba || null, location: `${m.city}, ${m.state}`, website_from_email: m.site || null,
    power_units: m.units, drivers: m.drivers, miles_per_year: m.miles, interstate: m.interstate, household_goods_authority: m.hhgAuth,
    broker_authority: m.broker, for_hire: m.forHire, number_of_cargo_types: m.cargoTypes, entity_type: m.org,
  });
  const out = await ask(state, { kind: { type: 'choice', instructions: 'What kind of company is this U.S. motor carrier, based on its FMCSA registration?', criteria: { ...KINDS } } });
  const a = out.answers.kind;
  const kind = (a?.choice in KINDS ? a.choice : 'other') as MoverKind;
  return { kind, confidence: Number(a?.confidence || 0), probabilities: a?.probabilities || {}, model: out.model };
}

/** How a non-mover carrier could work with a moving company (the partner shortlist). */
export const PARTNER_FITS = {
  moving_help: 'Could do moving work: furniture, appliance or white-glove delivery, office or household moves, or labor',
  vehicle_transport: 'Car hauler or vehicle transport that could ship our customers’ cars',
  linehaul: 'Freight or trucking carrier that could haul overflow or long-distance loads for a mover',
  storage_container: 'Containers, intermodal, portable storage or warehousing',
  broker: 'Broker, dispatcher or freight forwarder that arranges loads but doesn’t haul them',
  not_fit: 'Not a fit: specialized hauling (fuel, waste, livestock, towing only), a single truck leased to another carrier, or not an operating business',
} as const;
export type PartnerFit = keyof typeof PARTNER_FITS;

export async function classifyPartner(m: Mover & { services?: string }): Promise<{ fit: PartnerFit; confidence: number; probabilities: Record<string, number>; model: string }> {
  const state = JSON.stringify({
    legal_name: m.name, doing_business_as: m.dba || null, location: `${m.city}, ${m.state}`, website_from_email: m.site || null,
    cargo_it_hauls: m.services || null, other_cargo_written_in: m.otherCargo || null, power_units: m.units, drivers: m.drivers, miles_per_year: m.miles,
    interstate: m.interstate, active_federal_authority: m.authActive, household_goods_authority: m.hhgAuth, broker_authority: m.broker, registered: m.added || null,
  });
  const out = await ask(state, { fit: { type: 'choice', instructions: 'This U.S. motor carrier is not a household moving company. How could it work with a moving company as a partner or agent, based on its FMCSA registration?', criteria: { ...PARTNER_FITS } } });
  const a = out.answers.fit;
  const fit = (a?.choice in PARTNER_FITS ? a.choice : 'not_fit') as PartnerFit;
  return { fit, confidence: Number(a?.confidence || 0), probabilities: a?.probabilities || {}, model: out.model };
}

/** How Wont Stop Moving should treat a moving company. */
export const STRATEGIES = {
  partner: 'Agent or partner candidate: an established local mover outside our home market that could handle origin, destination, storage or overflow work for our network',
  study: 'A legend to learn from: large, long-running, franchise or van line brand; study its marketing, pricing and service rather than fight it head on',
  compete: 'Direct competitor in our home market (the San Francisco Bay Area, within about 60 miles of Mountain View, CA) that we must beat on reviews, price and marketing',
  acquire: 'Possible acquisition or buy-out target: a smaller, long-running, owner-run business with a weak web and social presence, a shrinking fleet or activity, or insurance and authority trouble',
  ignore: 'Not relevant: not really a household mover, inactive, or too small or far away to matter',
} as const;
export type Strategy = keyof typeof STRATEGIES;

/** What we know beyond the federal record (our own findings only; never Google Maps content). */
export type StrategySignals = {
  kind?: string | null; brand?: string | null; milesFromUs?: number | null; estimatedRevenue?: string | null;
  website?: string | null; socialPlatforms?: string[]; social?: { followers?: number | null; postsLast30?: number | null; daysSinceLastPost?: number | null } | null;
  legendGroup?: string | null;
  safety?: { grade: string | null; inspectionsLast12: number; trend: string | null; crashes: number; trouble: string[] } | null;
};

export async function classifyStrategy(m: Mover, s: StrategySignals): Promise<{ strategy: Strategy; confidence: number; probabilities: Record<string, number>; model: string }> {
  const state = JSON.stringify({
    us: 'Wont Stop Moving: a young moving company and marketplace in Mountain View, CA, building a North American network of local agent movers',
    company: {
      legal_name: m.name, doing_business_as: m.dba || null, location: `${m.city}, ${m.state}`, miles_from_us: s.milesFromUs ?? null,
      company_type: s.kind || null, brand_or_franchise: s.brand || null, legend_list: s.legendGroup || null,
      power_units: m.units, drivers: m.drivers, miles_per_year: m.miles, registered_since: m.added || null, interstate: m.interstate, household_goods_authority: m.hhgAuth,
      estimated_yearly_revenue: s.estimatedRevenue || null, website: s.website || m.site || null, social_platforms: s.socialPlatforms || [],
      safety_grade: s.safety?.grade ?? null, roadside_inspections_last_12_months: s.safety?.inspectionsLast12 ?? null, activity_trend: s.safety?.trend ?? null, crashes_last_24_months: s.safety?.crashes ?? null, recent_trouble: s.safety?.trouble ?? [],
      social_followers: s.social?.followers ?? null, posts_last_30_days: s.social?.postsLast30 ?? null, days_since_last_post: s.social?.daysSinceLastPost ?? null,
    },
  });
  const out = await ask(state, { strategy: { type: 'choice', instructions: 'How should Wont Stop Moving treat this moving company?', criteria: { ...STRATEGIES } } });
  const a = out.answers.strategy;
  const strategy = (a?.choice in STRATEGIES ? a.choice : 'ignore') as Strategy;
  return { strategy, confidence: Number(a?.confidence || 0), probabilities: a?.probabilities || {}, model: out.model };
}
