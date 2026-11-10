import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { enqueueEmail } from './notifications';
import { MOVE_PRICING } from '@/lib/pricing';

/**
 * Leads are customer quote requests (`quotes` that aren't admin-made custom
 * quotes). Lead-tracking fields live on the quote and are written only by the
 * server: leadStatus ('lost' when closed out), assignedTo, firstContactAt,
 * lastContactAt, lostReason, leadNotifiedAt.
 */
export const LEAD_FIELDS = ['leadStatus', 'assignedTo', 'assignedAt', 'firstContactAt', 'lastContactAt', 'lostReason', 'leadNotifiedAt'];

const ORIGIN = 'https://wontstopmoving.com';
const PHONE = '(415) 214-5474';

/**
 * Speed to lead: thank the customer at once and alert the team. Each email is
 * keyed by quote, so repeated calls never send twice. Never throws.
 */
export async function notifyNewLead(quoteId: string) {
  try {
    const ref = adminDb().doc(`quotes/${quoteId}`);
    const q = (await ref.get()).data();
    if (!q || q.isCustomQuote) return;
    const size = MOVE_PRICING[q.moveSize]?.description || q.moveSize || 'move';
    const total = Number(q.estimatedTotal || 0);
    const route = `${q.pickupZip || q.pickupAddress || '?'} → ${q.dropoffZip || q.dropoffAddress || '?'}`;
    if (q.email) {
      await enqueueEmail(`lead-ack:${quoteId}`, {
        category: 'lead', referenceId: quoteId, to: q.email,
        subject: 'Your Wont Stop Moving estimate',
        text: `Hi ${q.name || 'there'},\n\nThanks for your request. Here's your instant estimate:\n\n${size}, ${route}\nMove date: ${q.moveDate || 'not set'}\nEstimated total: $${total.toLocaleString()}\n\nYou can review it and book online any time:\n${ORIGIN}/dashboard/customer/quotes\n\nA member of our team may call you shortly to confirm the details. Questions? Call ${PHONE} or reply to this email.\n\nWhen you book, your mover is paid only after you confirm the job is done.\n\nWont Stop Moving`,
      });
    }
    await enqueueEmail(`lead-alert:${quoteId}`, {
      category: 'lead', referenceId: quoteId, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
      subject: `New lead: ${q.name || 'Customer'}, $${total.toLocaleString()} ${size}`,
      text: `New quote request. Call within 5 minutes.\n\nName: ${q.name || '—'}\nPhone: ${q.phone || '—'}\nEmail: ${q.email || '—'}\nMove: ${size}, ${route}\nDate: ${q.moveDate || 'not set'}\nEstimate: $${total.toLocaleString()}\n\nOpen the lead inbox:\n${ORIGIN}/dashboard/admin/leads\n\nWont Stop Moving`,
    });
    await ref.update({ leadNotifiedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    console.error('Lead notification failed', quoteId, error);
  }
}

/** Records a contact attempt on a lead (first contact time is kept). */
export async function markLeadContacted(db: Firestore, quoteId: string, uid: string) {
  const ref = db.doc(`quotes/${quoteId}`);
  await db.runTransaction(async tx => {
    const q = (await tx.get(ref)).data();
    if (!q || q.isCustomQuote) return;
    tx.update(ref, {
      ...(q.firstContactAt ? {} : { firstContactAt: FieldValue.serverTimestamp() }),
      lastContactAt: FieldValue.serverTimestamp(),
      ...(q.assignedTo ? {} : { assignedTo: uid, assignedAt: FieldValue.serverTimestamp() }),
      ...(q.leadStatus === 'lost' ? {} : { leadStatus: 'contacted' }),
    });
  });
}
