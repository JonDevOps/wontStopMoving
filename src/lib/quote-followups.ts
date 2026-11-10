/**
 * Follow-up emails for quotes that haven't booked. Pure logic (no imports),
 * so it is unit-tested directly; the server job in lib/server/followups.ts
 * reads quotes, calls these, and sends.
 *
 * The customer already gets their estimate instantly when they request it,
 * so follow-ups start a day later.
 */
export const FOLLOW_UP_STEPS = [
  { step: 1, afterHours: 24 },
  { step: 2, afterHours: 72 },
  { step: 3, afterHours: 168 },
] as const;
/** Quotes older than this get no more follow-ups. */
export const FOLLOW_UP_MAX_AGE_HOURS = 192;

export type FollowUpState = {
  createdAtMs: number | null;
  sentStep: number;
  hasEmail: boolean;
  booked: boolean;
  lost: boolean;
  stopped: boolean;
  suppressed: boolean;
};

/**
 * The follow-up to send now, or null. If the job missed a step (for example
 * it was down), only the latest due step is sent, never a burst of emails.
 */
export function dueFollowUpStep(s: FollowUpState, nowMs: number): number | null {
  if (!s.createdAtMs || !s.hasEmail || s.booked || s.lost || s.stopped || s.suppressed) return null;
  const ageHours = (nowMs - s.createdAtMs) / 3600000;
  if (ageHours < 0 || ageHours > FOLLOW_UP_MAX_AGE_HOURS) return null;
  const due = [...FOLLOW_UP_STEPS].reverse().find(f => ageHours >= f.afterHours);
  return due && due.step > s.sentStep ? due.step : null;
}

export type FollowUpQuote = { name?: string; moveLabel: string; route: string; moveDate?: string; total: number };
export type FollowUpLinks = { bookUrl: string; quoteUrl: string; unsubscribeUrl: string; phone: string; postalAddress?: string };

export function followUpEmail(step: number, q: FollowUpQuote, links: FollowUpLinks): { subject: string; text: string } {
  const hi = `Hi ${q.name?.trim() || 'there'},`;
  const summary = `${q.moveLabel}, ${q.route}\nMove date: ${q.moveDate || 'not set'}\nEstimated total: $${Math.round(q.total).toLocaleString()}`;
  const footer = `\n\nWont Stop Moving · ${links.phone}${links.postalAddress ? `\n${links.postalAddress}` : ''}\nDon't want these reminders? Unsubscribe: ${links.unsubscribeUrl}`;
  if (step === 1) return {
    subject: 'Your moving estimate is ready to book',
    text: `${hi}\n\nYour estimate is saved and ready whenever you are:\n\n${summary}\n\nBook online in a couple of minutes:\n${links.bookUrl}\n\nYou pay securely by card when you book, and your mover isn't paid until you confirm the job is done with your private 6-digit code.\n\nQuestions? Reply to this email or call ${links.phone}.${footer}`,
  };
  if (step === 2) return {
    subject: 'Any questions about your move?',
    text: `${hi}\n\nPeople often ask a few things before booking, so here are quick answers:\n\n• What's included? The price covers the move size and any add-ons in your estimate. You can review every line before you book.\n• Who are the movers? Independent moving professionals who pass identity verification, with reviews from past customers.\n• What if something goes wrong? Your mover isn't paid until you confirm the job is done with your 6-digit release code.\n• Can I change details? Yes. If your date, size or add-ons change, request a new quote or call us and we'll update it.\n\nYour estimate: $${Math.round(q.total).toLocaleString()} for ${q.moveLabel.toLowerCase()} on ${q.moveDate || 'your date'}.\n${links.bookUrl}\n\nReply or call ${links.phone} with anything else.${footer}`,
  };
  return {
    subject: `Still planning your move${q.moveDate ? ` on ${q.moveDate}` : ''}?`,
    text: `${hi}\n\nThis is our last reminder about your estimate:\n\n${summary}\n\nIf your plans changed, no problem. If you'd like a different date, size or service, call ${links.phone} or get a fresh quote:\n${links.quoteUrl}\n\nReady to go? Book here:\n${links.bookUrl}${footer}`,
  };
}
