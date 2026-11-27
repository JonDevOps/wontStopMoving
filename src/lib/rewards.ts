/** Prepaid gift cards can cover a full move; promotional rewards retain their 15% cap. */
export const MOVE_CREDIT_USD = Number(process.env.MOVE_CREDIT_USD || 25);
/** Matches the platform fee (1 - PROVIDER_SHARE): credit never comes out of the mover's pay. */
export const MAX_CREDIT_SHARE = 0.15;

export const GIFT_CARD_MIN = 25;
export const GIFT_CARD_MAX = 1000;
export const GIFT_CARD_PRESETS = [50, 100, 250, 500] as const;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function creditBreakdown(total: number, balance: number, giftBalance = 0) {
  if (![total, balance, giftBalance].every(Number.isFinite) || total <= 0 || balance <= 0) return { credit: 0, gift: 0, reward: 0 };
  const price = Math.round(total * 100), available = Math.max(0, Math.round(balance * 100));
  const gifts = Math.min(available, Math.max(0, Math.round(giftBalance * 100)));
  let gift = Math.min(price, gifts);
  let reward = Math.min(price - gift, available - gifts, Math.floor(price * MAX_CREDIT_SHARE));
  // Stripe requires at least 50 cents for a nonzero USD card charge.
  const remaining = price - gift - reward;
  if (remaining > 0 && remaining < 50) {
    let giveBack = Math.min(50 - remaining, gift + reward);
    const rewardBack = Math.min(reward, giveBack); reward -= rewardBack; giveBack -= rewardBack;
    gift -= giveBack;
  }
  return { credit: (gift + reward) / 100, gift: gift / 100, reward: reward / 100 };
}

export function usableCredit(total: number, balance: number, giftBalance = 0): number {
  return creditBreakdown(total, balance, giftBalance).credit;
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
  'booking-refund': 'Refund for a cancelled booking',
  'gift-refund': 'Returned to gift-card balance',
  'review-gift-refund': '$5 review refund to gift-card balance',
  'admin': 'Added by our team',
};

/** Refund paid value proportionally to the original gift/card tender; reward discounts are not cash. */
export function refundTenderSplit(refundCents: number, giftCents: number, cardCents: number) {
  if (![refundCents,giftCents,cardCents].every(Number.isSafeInteger) || Math.min(refundCents,giftCents,cardCents)<0 || refundCents>giftCents+cardCents) throw new Error('Invalid refund amount.');
  const gift = giftCents + cardCents ? Math.round(refundCents * giftCents / (giftCents + cardCents)) : 0;
  return { giftCents: gift, cardCents: refundCents - gift };
}
