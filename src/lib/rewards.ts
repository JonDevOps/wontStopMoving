/**
 * Rewards and gift cards: pure rules shared by the server and the UI.
 *
 * Customers keep a move-credit balance (rewardWallets/{uid}, server-only). It
 * grows from completed moves and redeemed gift cards, and pays for part of a
 * move at checkout. Credit can cover at most the platform's 15% share of a
 * move, so the mover's 85% is always paid in full from the card charge.
 */
export const MOVE_CREDIT_USD = Number(process.env.MOVE_CREDIT_USD || 25);
/** Matches the platform fee (1 - PROVIDER_SHARE): credit never comes out of the mover's pay. */
export const MAX_CREDIT_SHARE = 0.15;

export const GIFT_CARD_MIN = 25;
export const GIFT_CARD_MAX = 1000;
export const GIFT_CARD_PRESETS = [50, 100, 250, 500] as const;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const cents = (n: number) => Math.round(n * 100) / 100;

/** How much of `balance` can go toward a move priced at `total`. */
export function usableCredit(total: number, balance: number): number {
  if (!(total > 0) || !(balance > 0)) return 0;
  return cents(Math.min(balance, Math.floor(total * MAX_CREDIT_SHARE * 100) / 100));
}

/** Whole-dollar gift card amount in range, or null. */
export function giftCardAmount(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= GIFT_CARD_MIN && n <= GIFT_CARD_MAX ? n : null;
}

/** Gift card codes look like WSM-ABCD-EFGH (no 0/O or 1/I). */
export const normalizeGiftCode = (raw: unknown) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^WSM/, '');
export const formatGiftCode = (core: string) => `WSM-${core.slice(0, 4)}-${core.slice(4, 8)}`;
export const isGiftCodeCore = (core: string) => core.length === 8 && [...core].every(c => CODE_ALPHABET.includes(c));
export function newGiftCodeCore(rand: (n: number) => number): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[rand(CODE_ALPHABET.length)]).join('');
}

export type LedgerEntry = { id: string; amount: number; reason: string; createdAt: string | null };
export const LEDGER_REASONS: Record<string, string> = {
  'move-completed': 'Thank-you credit for your move',
  'gift-card': 'Gift card redeemed',
  'checkout': 'Used toward a move',
  'checkout-released': 'Returned from an unfinished checkout',
  'admin': 'Added by our team',
};
