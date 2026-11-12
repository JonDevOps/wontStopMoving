import { CalendarClock } from 'lucide-react';

/**
 * "Pay over time" note shown with move prices. Affirm and Klarna appear in
 * Stripe Checkout once they're turned on in the Stripe Dashboard (see
 * docs/financing.md); set NEXT_PUBLIC_FINANCING_ENABLED=1 at the same time.
 */
export const FINANCING_ENABLED = process.env.NEXT_PUBLIC_FINANCING_ENABLED === '1';
/** Below this a monthly plan isn't worth showing. */
export const FINANCING_MIN_USD = 300;

export function FinancingNote({ total, className = '' }: { total?: number; className?: string }) {
  if (!FINANCING_ENABLED || (typeof total === 'number' && total < FINANCING_MIN_USD)) return null;
  return (
    <p className={`text-xs text-muted-foreground flex items-start gap-1.5 ${className}`}>
      <CalendarClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>Pay over time with <b>Affirm</b> or <b>Klarna</b> at checkout{typeof total === 'number' ? <> (for example, 4 payments of about <b>${Math.ceil(total / 4).toLocaleString()}</b>)</> : null}. Subject to approval; your plan&apos;s terms are shown before you confirm.</span>
    </p>
  );
}
