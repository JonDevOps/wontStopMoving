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
