import { adminAuth, adminDb } from './firebase-admin';
import { enqueueEmail } from './notifications';

const ORIGIN = 'https://wontstopmoving.com';
const PHONE = '(415) 214-5474';

/** Tomorrow's date as YYYY-MM-DD in US Eastern time (move dates are stored that way). */
export function tomorrowEastern(nowMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs + 86400000));
  return parts; // en-CA formats as YYYY-MM-DD
}

/**
 * Day-before reminders for paid moves: the customer gets a short checklist
 * and a reminder about their release code; the assigned crew gets the job
 * reminder. Run hourly; each email is keyed per job and person, so it is
 * sent once.
 */
export async function runMoveReminders(nowMs = Date.now()) {
  const date = tomorrowEastern(nowMs);
  const snap = await adminDb().collection('jobs').where('moveDate', '==', date).limit(300).get();
  let sent = 0;
  for (const doc of snap.docs) {
    const job = doc.data();
    if (job.paymentStatus !== 'paid' || job.status === 'cancelled' || job.status === 'completed') continue;
    try {
      const where = `${job.pickupAddress || 'pickup'} → ${job.dropoffAddress || 'drop-off'}`;
      if (job.customerId) {
        const customer = (await adminDb().doc(`users/${job.customerId}`).get()).data();
        if (customer?.email) {
          await enqueueEmail(`move-reminder:${doc.id}:customer`, {
            category: 'reminder', referenceId: doc.id, to: customer.email,
            subject: 'Your move is tomorrow',
            text: `Hi ${customer.name || 'there'},\n\nYour move is tomorrow (${date}): ${where}.\n\nA few things to do today:\n• Keep a clear path and parking spot for the crew.\n• Set aside a bag with essentials, documents and chargers.\n• Reserve elevators or loading areas if your building requires it.\n\nYour 6-digit release code is in your dashboard. Give it to your mover only when the job is done to your satisfaction:\n${ORIGIN}/dashboard/customer/moves/${doc.id}\n\nNeed to change something? Call ${PHONE} or use "Need help with this move?" on that page.\n\nWont Stop Moving`,
          });
          sent++;
        }
      }
      for (const uid of [...(job.providerIds || []), ...(job.employeeIds || [])]) {
        try {
          const crew = await adminAuth().getUser(uid);
          if (!crew.email) continue;
          await enqueueEmail(`move-reminder:${doc.id}:${uid}`, {
            category: 'reminder', referenceId: doc.id, to: crew.email,
            subject: `Job tomorrow: ${where}`.slice(0, 200),
            text: `You have a moving job tomorrow (${date}): ${where}.\n\nJob details:\n${ORIGIN}/dashboard/${(job.providerIds || []).includes(uid) ? 'provider' : 'employee'}/jobs/${doc.id}\n\nAt the end of the job, ask the customer for their 6-digit release code to complete it and release payment.\n\nWont Stop Moving`,
          });
          sent++;
        } catch (error: any) { if (error?.code !== 'auth/user-not-found') throw error; }
      }
    } catch (error) {
      console.error('Move reminder failed', doc.id, error);
    }
  }
  return { date, jobs: snap.size, sent };
}
