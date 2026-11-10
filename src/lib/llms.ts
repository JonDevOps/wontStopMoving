/**
 * Markdown for AI assistants and agents (/llms.txt, /llms-full.txt and the .md pages).
 * Everything is generated from the site's real data so it can't drift.
 */
import { ADDON_PRICING, MOVE_PRICING } from '@/lib/pricing';
import { FAQ_CATEGORIES } from '@/lib/faq-data';
import { ALL_LOCATIONS, CITIES_BY_STATE, slugify } from '@/lib/location-data';
import { DEFAULT_DESCRIPTION, SERVICES, SITE_EMAIL, SITE_URL } from '@/lib/seo';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

const ADDON_NAMES: Record<string, string> = {
  packing: 'Professional packing',
  crating: 'Specialty crating',
  cleaning: 'Move-out deep cleaning',
  junk: 'Junk removal (about 1/4 truck)',
  assembly: 'Furniture assembly / handyman',
  storage: 'Vaulted storage',
  piano: 'Upright piano',
};

export function pricingMd(): string {
  const sizes = new Map<string, string>();
  for (const [key, plan] of Object.entries(MOVE_PRICING)) {
    if (!sizes.has(plan.description)) sizes.set(plan.description, `| ${plan.description} | ${usd(plan.baseFee)} | \`${key}\` |`);
  }
  const addons = Object.entries(ADDON_PRICING).map(([k, v]) => `| ${ADDON_NAMES[k] || k} | +${usd(v)} |`);
  return `# Wont Stop Moving: Pricing

Instant-quote prices come from this list. A quote is the move-size base price plus any add-ons.

## Move size (base price)

| Move size | Base price | Code |
|---|---|---|
${[...sizes.values()].join('\n')}

## Add-ons

| Add-on | Price |
|---|---|
${addons.join('\n')}

## Adjustments

- **Express moving:** +25% of the base price for priority scheduling.
- **Student or military:** 5% off the total.

## Booking a specific mover

When you book an individual mover from the marketplace, the price is that mover's hourly rate times the hours you book (each mover sets a minimum number of hours).

Get an instant quote: ${SITE_URL}/quote
`;
}

export function howBookingWorksMd(): string {
  return `# How booking works at Wont Stop Moving

1. **Get a quote.** Enter your ZIP codes, move size, date and any add-ons at ${SITE_URL}/quote. You get an instant estimate from our price list (${SITE_URL}/pricing.md).
2. **Create a free account.** Sign up with Google or email to save and pay for your quote. You can also book an individual mover from the marketplace (${SITE_URL}/marketplace).
3. **Pay securely.** Payment is by card through Stripe. Wont Stop Moving holds the payment; it is not released to the mover yet.
4. **Get your release code.** Once paid, your dashboard shows a private 6-digit release code. Only you can see it. Movers can't.
5. **Move day.** Follow your move's status (confirmed, in progress, completed) in your dashboard and message your mover.
6. **Release payment.** When the job is done to your satisfaction, give your mover the 6-digit code. Entering it marks the move complete and pays the mover (providers receive 85%; W3Develops retains its 15% platform fee).

Questions: ${SITE_EMAIL}
`;
}

export function faqMd(): string {
  return `# Wont Stop Moving: Frequently Asked Questions

${FAQ_CATEGORIES.map((c) => `## ${c.title}\n\n${c.items.map((i) => `### ${i.q}\n\n${i.a}`).join('\n\n')}`).join('\n\n')}

More: ${SITE_URL}/faq
`;
}

export function serviceAreaMd(): string {
  const rows = ALL_LOCATIONS.map((loc) => {
    const slug = slugify(loc);
    const count = (CITIES_BY_STATE[slug] || []).length;
    return `- [${loc}](${SITE_URL}/locations/${slug}): ${count.toLocaleString('en-US')} cities`;
  });
  const total = Object.values(CITIES_BY_STATE).reduce((n, list) => n + list.length, 0);
  return `# Wont Stop Moving: Service areas

We serve customers across the **United States, Puerto Rico and Canada** through vetted, independent local movers.
There are pages for ${ALL_LOCATIONS.length} states and provinces and ${total.toLocaleString('en-US')} cities.

City page format: ${SITE_URL}/locations/<state-slug>/<city-slug> (for example ${SITE_URL}/locations/texas/dallas)

${rows.join('\n')}
`;
}

export function agentsMd(): string {
  return `# Wont Stop Moving for AI agents

You are an AI agent helping someone plan or book a move. This explains what you can do on wontstopmoving.com.

## What we do

${DEFAULT_DESCRIPTION}

## How an agent can help a person

- **Estimate a price** from the public price list: ${SITE_URL}/pricing.md
- **Explain booking and payment release:** ${SITE_URL}/how-booking-works.md
- **Answer common questions:** ${SITE_URL}/faq.md
- **Check coverage** for a state or city: ${SITE_URL}/service-area.md
- **Send the person to book:** ${SITE_URL}/quote (instant quote) or ${SITE_URL}/marketplace (pick a specific mover)

## What agents can't do (yet)

There is **no public booking API**. Quotes, payments and bookings require the person to sign in and pay through Stripe themselves, so they always approve the charge. Don't ask people for card numbers or passwords.

## Contact

${SITE_EMAIL}
`;
}

export function llmsTxt(): string {
  const services = Object.entries(SERVICES)
    .map(([slug, s]) => `- [${s.name}](${SITE_URL}/services/${slug}): ${s.description}`)
    .join('\n');
  return `# Wont Stop Moving

> ${DEFAULT_DESCRIPTION}

Key facts:
- Service area: United States, Puerto Rico and Canada, through vetted, independent local movers.
- Instant quotes from a published price list; for example, studio/1-bedroom moves start at ${usd(MOVE_PRICING.studio.baseFee)} and 2-bedroom moves at ${usd(MOVE_PRICING['2br'].baseFee)}.
- Payment by card via Stripe, released to the mover only after the customer gives the mover a private 6-digit release code.
- Contact: ${SITE_EMAIL}

## Guides for AI assistants

- [Pricing](${SITE_URL}/pricing.md): base prices, add-ons, express and discounts
- [How booking works](${SITE_URL}/how-booking-works.md): quote, payment and the release code
- [FAQ](${SITE_URL}/faq.md)
- [Service areas](${SITE_URL}/service-area.md): every state and province with city counts
- [For AI agents](${SITE_URL}/AGENTS.md)
- [Everything in one file](${SITE_URL}/llms-full.txt)

## Services

${services}

## Main pages

- [Get a quote](${SITE_URL}/quote)
- [Book a mover](${SITE_URL}/book) · [Marketplace](${SITE_URL}/marketplace)
- [Service areas](${SITE_URL}/locations)
- [Moving tips blog](${SITE_URL}/blog)
- [About](${SITE_URL}/about) · [Contact](${SITE_URL}/contact) · [Careers](${SITE_URL}/careers)
`;
}

export function llmsFullTxt(): string {
  return [llmsTxt(), pricingMd(), howBookingWorksMd(), faqMd(), agentsMd(), serviceAreaMd()].join('\n\n---\n\n');
}
