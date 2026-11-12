/**
 * Moving concierge: extra services from local partners, offered on each move.
 * The customer asks; our team introduces a vetted partner (from
 * conciergePartners) and tracks the referral fee. Requests live in
 * conciergeRequests (server-only).
 */
export const CONCIERGE_SERVICES = {
  cleaning: { label: 'Move-out / move-in cleaning', blurb: 'Deposit-ready deep clean of the old or new place.' },
  handyman: { label: 'Handyman & TV mounting', blurb: 'Patch holes, hang shelves, mount TVs, fix doors.' },
  storage: { label: 'Storage unit', blurb: 'Short or long term, near your old or new home.' },
  childcare: { label: 'Babysitter or pet sitter', blurb: 'Someone to watch kids or pets on moving day.' },
  landscaping: { label: 'Yard clean-up', blurb: 'Get the yard ready to hand over or move into.' },
  utilities: { label: 'Internet & utilities setup', blurb: 'Line up internet, power and gas at the new place.' },
  junk: { label: 'Junk & donation pickup', blurb: 'Haul away what you are not taking.' },
  'auto-transport': { label: 'Car shipping', blurb: 'Ship a car to your new city.' },
} as const;
export type ConciergeService = keyof typeof CONCIERGE_SERVICES;
export const isConciergeService = (v: unknown): v is ConciergeService => typeof v === 'string' && v in CONCIERGE_SERVICES;

export const CONCIERGE_STATUSES = { new: 'New', introduced: 'Partner introduced', booked: 'Booked', closed: 'Closed' } as const;
export type ConciergeStatus = keyof typeof CONCIERGE_STATUSES;
export const isConciergeStatus = (v: unknown): v is ConciergeStatus => typeof v === 'string' && v in CONCIERGE_STATUSES;
