import { randomBytes } from 'node:crypto';
import { enqueueEmail } from './notifications';

const ORIGIN = 'https://wontstopmoving.com';
export type FeedbackKind = 'ticket' | 'request';

/** A random token that lets the customer rate the help they got, without signing in. */
export const newFeedbackToken = () => randomBytes(18).toString('hex');

/** Emails the customer the resolution and a one-click "How did we do?" survey. Never throws. */
export async function sendResolutionEmail(opts: { kind: FeedbackKind; id: string; token: string; to: string; name?: string; subject: string; message?: string }) {
  try {
    const link = (score: number) => `${ORIGIN}/feedback?k=${opts.kind}&id=${encodeURIComponent(opts.id)}&t=${opts.token}&s=${score}`;
    await enqueueEmail(`resolved:${opts.kind}:${opts.id}`, {
      category: 'service', referenceId: opts.id, to: opts.to,
      subject: `Resolved: ${opts.subject}`.slice(0, 200),
      text: `Hi ${opts.name || 'there'},\n\n${opts.message?.trim() || 'We\'ve resolved your request.'}\n\nHow did we do? Tap a rating (5 is best):\n5: ${link(5)}\n4: ${link(4)}\n3: ${link(3)}\n2: ${link(2)}\n1: ${link(1)}\n\nIf anything still isn't right, reply to this email or call (415) 214-5474.\n\nWont Stop Moving`,
    });
  } catch (error) {
    console.error('Resolution email failed', opts.kind, opts.id, error);
  }
}
