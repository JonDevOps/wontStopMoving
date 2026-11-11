/**
 * Moving supplies shop: the catalog, fulfillment options and cart pricing.
 * Prices are set here and always recalculated on the server. Pure logic
 * (no imports) so it can be unit-tested directly.
 */
export type ShopItem = { id: string; name: string; description: string; price: number; category: 'Kits' | 'Boxes' | 'Packing' | 'Protection'; unit?: string };

export const CATALOG: ShopItem[] = [
  { id: 'kit-studio', name: 'Studio moving kit', description: '10 small, 8 medium, 4 large boxes, packing paper, 2 rolls of tape, markers.', price: 89, category: 'Kits' },
  { id: 'kit-1br', name: '1-bedroom moving kit', description: '15 small, 12 medium, 6 large boxes, 1 wardrobe box, packing paper, bubble wrap, 3 rolls of tape.', price: 139, category: 'Kits' },
  { id: 'kit-2br', name: '2-bedroom moving kit', description: '25 small, 20 medium, 10 large boxes, 2 wardrobe boxes, 2 dish packs, packing paper, bubble wrap, 6 rolls of tape.', price: 229, category: 'Kits' },
  { id: 'kit-3br', name: '3-bedroom moving kit', description: '35 small, 30 medium, 15 large boxes, 3 wardrobe boxes, 3 dish packs, packing paper, bubble wrap, 8 rolls of tape.', price: 349, category: 'Kits' },
  { id: 'box-small', name: 'Small box', description: '16 × 12 × 12 in. Books, tools, canned goods.', price: 2.5, category: 'Boxes', unit: 'each' },
  { id: 'box-medium', name: 'Medium box', description: '18 × 18 × 16 in. Kitchen items, toys, small appliances.', price: 3.25, category: 'Boxes', unit: 'each' },
  { id: 'box-large', name: 'Large box', description: '18 × 18 × 24 in. Linens, pillows, lampshades.', price: 4.25, category: 'Boxes', unit: 'each' },
  { id: 'box-wardrobe', name: 'Wardrobe box', description: 'With hanging bar: move clothes on their hangers.', price: 18, category: 'Boxes', unit: 'each' },
  { id: 'box-dish', name: 'Dish pack box', description: 'Double-wall box for dishes and glassware.', price: 8, category: 'Boxes', unit: 'each' },
  { id: 'box-tv', name: 'TV box', description: 'Adjustable box for 40–70 in. flat-screen TVs.', price: 35, category: 'Boxes', unit: 'each' },
  { id: 'paper', name: 'Packing paper', description: '10 lb bundle of clean newsprint (about 200 sheets).', price: 18, category: 'Packing' },
  { id: 'bubble', name: 'Bubble wrap', description: '12 in. × 100 ft roll.', price: 22, category: 'Packing' },
  { id: 'tape', name: 'Packing tape 6-pack', description: 'Six rolls with a tape gun.', price: 16, category: 'Packing' },
  { id: 'stretch', name: 'Stretch wrap', description: '20 in. × 1,000 ft roll for drawers and furniture.', price: 14, category: 'Protection' },
  { id: 'mattress-bag', name: 'Mattress bag', description: 'Heavy-duty plastic, fits queen and king.', price: 9, category: 'Protection', unit: 'each' },
  { id: 'blanket', name: 'Moving blanket', description: 'Quilted furniture pad, 72 × 80 in.', price: 15, category: 'Protection', unit: 'each' },
];
export const ITEM_BY_ID = new Map(CATALOG.map(i => [i.id, i]));

export const FULFILLMENT = {
  'with-move': { label: 'Bring it with my move', note: 'Free: your crew brings everything on moving day (needs a booked move).', fee: 0 },
  delivery: { label: 'Deliver to me', note: 'Bay Area delivery within 2 business days. Free on orders of $150 or more.', fee: 15 },
  pickup: { label: 'Pick up in Mountain View', note: 'Free pickup at 855 Maude Ave, Mountain View. We’ll text when it’s ready.', fee: 0 },
} as const;
export type Fulfillment = keyof typeof FULFILLMENT;
export const FREE_DELIVERY_OVER = 150;

/** California sales tax on supplies (Mountain View, Santa Clara County). Adjust when the rate changes. */
export const SALES_TAX_RATE = 0.09125;
export const MAX_QTY = 200;

export type CartLine = { id: string; qty: number };
export type PricedCart = { lines: { id: string; name: string; qty: number; price: number; total: number }[]; subtotal: number; delivery: number; tax: number; total: number };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Prices a cart. Unknown items and bad quantities are dropped; null if empty. */
export function priceCart(raw: unknown, fulfillment: Fulfillment): PricedCart | null {
  const merged = new Map<string, number>();
  for (const l of Array.isArray(raw) ? raw : []) {
    const id = typeof (l as CartLine)?.id === 'string' ? (l as CartLine).id : '';
    const qty = Math.floor(Number((l as CartLine)?.qty));
    if (!ITEM_BY_ID.has(id) || !Number.isFinite(qty) || qty < 1) continue;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
  }
  if (!merged.size) return null;
  const lines = [...merged].map(([id, qty]) => { const item = ITEM_BY_ID.get(id)!; return { id, name: item.name, qty, price: item.price, total: cents(item.price * qty) }; });
  const subtotal = cents(lines.reduce((n, l) => n + l.total, 0));
  const delivery = fulfillment === 'delivery' && subtotal < FREE_DELIVERY_OVER ? FULFILLMENT.delivery.fee : 0;
  const tax = cents(subtotal * SALES_TAX_RATE);
  return { lines, subtotal, delivery, tax, total: cents(subtotal + delivery + tax) };
}

export const ORDER_STATUSES = { pending: 'Awaiting payment', paid: 'Paid: preparing', ready: 'Ready for pickup', 'out-for-delivery': 'Out for delivery', fulfilled: 'Delivered / picked up', cancelled: 'Cancelled' } as const;
export type OrderStatus = keyof typeof ORDER_STATUSES;
