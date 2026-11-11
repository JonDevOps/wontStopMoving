/** Customer service requests about a booked move. Shared by the customer and admin screens. */
export type ServiceRequestType = 'reschedule' | 'cancel' | 'claim';
export type ServiceRequestStatus = 'open' | 'in-progress' | 'resolved';

export const SERVICE_REQUEST_LABELS: Record<ServiceRequestType, string> = {
  reschedule: 'Reschedule request',
  cancel: 'Cancellation request',
  claim: 'Damage or missing item claim',
};

/** First-response targets, in hours. Reschedules and cancellations are time-sensitive. */
export const RESPONSE_TARGET_HOURS: Record<ServiceRequestType | 'support', number> = {
  reschedule: 4, cancel: 4, claim: 24, support: 4,
};

export type WaitStatus = { hours: number; overdue: boolean; label: string };
/** How long something has waited for a first response, against its target. */
export function waitStatus(createdAtMs: number | null, target: number, nowMs = Date.now()): WaitStatus {
  if (!createdAtMs) return { hours: 0, overdue: false, label: '' };
  const hours = Math.max(0, (nowMs - createdAtMs) / 3600000);
  const label = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`;
  return { hours, overdue: hours >= target, label };
}

/** Saved replies for the support inbox. [Name] is filled in with the customer's first name. */
export const SAVED_REPLIES: { id: string; label: string; body: string }[] = [
  { id: 'thanks', label: 'Thanks, looking into it', body: 'Hi [Name],\n\nThanks for reaching out. I\'m looking into this now and will get back to you today with an update.\n\nWont Stop Moving · (415) 214-5474' },
  { id: 'quote', label: 'How to get a quote', body: 'Hi [Name],\n\nYou can get an instant price at https://wontstopmoving.com/quote. It takes about two minutes, and you can book online right after. If you\'d like help, call us at (415) 214-5474.\n\nWont Stop Moving' },
  { id: 'reschedule', label: 'Reschedule: checking availability', body: 'Hi [Name],\n\nI\'m checking crew availability for your new date and whether the change affects your price. I\'ll confirm before changing anything.\n\nWont Stop Moving · (415) 214-5474' },
  { id: 'release-code', label: 'Where is my release code?', body: 'Hi [Name],\n\nYour 6-digit release code is in your Wont Stop Moving dashboard: open My Moves and select your move. Only give it to your mover once the job is done to your satisfaction, because that\'s what releases their payment.\n\nWont Stop Moving' },
  { id: 'claim', label: 'Claim received', body: 'Hi [Name],\n\nI\'m sorry about the trouble with your move. We\'ve received your report and are reviewing the details and photos with the crew. You\'ll hear from us within one business day with next steps.\n\nWont Stop Moving · (415) 214-5474' },
  { id: 'provider', label: 'Becoming a provider', body: 'Hi [Name],\n\nThanks for your interest in working with us. Independent moving providers can apply at https://wontstopmoving.com/provider-signup. Applications are reviewed after identity verification.\n\nWont Stop Moving' },
];
