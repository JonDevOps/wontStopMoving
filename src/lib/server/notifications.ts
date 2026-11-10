import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './firebase-admin';
import { customQuotePricingText } from '../custom-quotes';

const ORIGIN = 'https://wontstopmoving.com';
// ZOHO_SMTP_USER must be the real Zoho mailbox (aliases can't sign in to SMTP).
// The From address can be an alias on that mailbox, e.g. noreply@wontstopmoving.com.
export function mailConfigured() { return !!process.env.ZOHO_SMTP_USER && !!process.env.ZOHO_SMTP_PASS && !/placeholder|your[_-]|changeme/i.test(process.env.ZOHO_SMTP_PASS); }

export async function deliverEmail(id: string) {
  const db = adminDb(), ref = db.doc(`emailOutbox/${id}`);
  if (!mailConfigured()) return 'pending_configuration';
  const message = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data || data.status !== 'pending') return null;
    tx.update(ref, { status: 'sending', attemptedAt: FieldValue.serverTimestamp() });
    return data;
  });
  if (!message) return (await ref.get()).data()?.status || 'missing';
  try {
    const port = Number(process.env.ZOHO_SMTP_PORT || 465);
    const transport = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com', port, secure: port === 465, requireTLS: port !== 465, auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    try {
      const unsubscribe = typeof message.unsubscribeUrl === 'string' && message.unsubscribeUrl.startsWith('https://') ? message.unsubscribeUrl : null;
      const result = await transport.sendMail({ from: process.env.EMAIL_FROM_ADDRESS || 'Wont Stop Moving <noreply@wontstopmoving.com>', replyTo: process.env.EMAIL_REPLY_TO || 'support@wontstopmoving.com', to: message.to, subject: message.subject, text: message.text, messageId: `<${id}@wontstopmoving.com>`, ...(unsubscribe ? { headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}) });
      if (!result.accepted?.length) throw new Error('SMTP_REJECTED');
      await ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp() });
      return 'sent';
    } finally { transport.close(); }
  } catch {
    // SMTP failure may be ambiguous. Hold for review instead of automatically
    // resending and potentially delivering duplicate customer messages.
    await ref.update({ status: 'needs_review', failureCode: 'SMTP_DELIVERY_FAILED' });
    return 'needs_review';
  }
}

export async function enqueueEmail(key: string, message: { to: string; subject: string; text: string; category: string; referenceId: string; unsubscribeUrl?: string }) {
  const id = createHash('sha256').update(key).digest('hex');
  const ref = adminDb().doc(`emailOutbox/${id}`);
  await adminDb().runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.create(ref, { ...message, status: 'pending', createdAt: FieldValue.serverTimestamp() }); });
  return { id, status: await deliverEmail(id) };
}

export async function queueQuoteEmail(id: string) {
  const q = (await adminDb().doc(`quotes/${id}`).get()).data();
  if (!q?.isCustomQuote) throw new Error('CUSTOM_QUOTE_REQUIRED');
  return enqueueEmail(`quote:${id}`, { category: 'quote', referenceId: id, to: q.email, subject: 'Your Wont Stop Moving custom quote', text: `Hi ${q.name},\n\n${q.description}\n\n${customQuotePricingText(q.pricing)}\nRoute: ${q.pickupAddress} → ${q.dropoffAddress}\nMove date: ${q.moveDate}\nExpires: ${q.expiresAt.toDate().toISOString()}\n\nReview your private quote: ${ORIGIN}/custom-quotes/${id}\nUse a verified customer account with this email address.\n\nWont Stop Moving` });
}

export async function queueAccountApproval(uid: string, role: 'provider' | 'employee') {
  const account = await adminAuth().getUser(uid);
  if (!account.email) return null;
  return enqueueEmail(`approval:${role}:${uid}`, { category: 'approval', referenceId: uid, to: account.email, subject: 'Your Wont Stop Moving account is approved', text: `Your ${role} account has been approved. Review your dashboard for next steps:\n${ORIGIN}/dashboard/${role}\n\nWont Stop Moving` });
}

export async function queueJobEmails(jobId: string) {
  const job = (await adminDb().doc(`jobs/${jobId}`).get()).data();
  if (!job || job.paymentStatus !== 'paid' || job.status === 'cancelled') return;
  const recipients = new Map<string, string>();
  if (job.customerId) recipients.set(job.customerId, 'customer');
  for (const uid of job.providerIds || []) recipients.set(uid, 'provider');
  for (const uid of job.employeeIds || []) recipients.set(uid, 'employee');
  for (const [uid, role] of recipients) {
    let account;
    try { account = await adminAuth().getUser(uid); } catch (error: any) { if (error?.code === 'auth/user-not-found') continue; throw error; }
    if (!account.email) continue;
    await enqueueEmail(`job:${jobId}:${uid}`, { category: 'job', referenceId: jobId, to: account.email, subject: role === 'customer' ? 'Your moving booking is confirmed' : 'A moving job has been assigned to you', text: `View your ${role === 'customer' ? 'confirmed move' : 'assigned job'} in your secure dashboard:\n${ORIGIN}/dashboard/${role}/${role === 'customer' ? 'moves' : 'jobs'}/${jobId}\n\nSign in to view job details. Keep your payment release code private.\n\nWont Stop Moving` });
  }
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org';
  await enqueueEmail(`job:${jobId}:admin`, { category: 'job', referenceId: jobId, to: adminEmail, subject: `New paid booking: ${job.moveDate || 'date pending'}`, text: `A booking was just paid.\n\nMove date: ${job.moveDate || 'Not set'}\nPickup: ${job.pickupAddress || 'Not set'}\nDrop-off: ${job.dropoffAddress || 'Not set'}\nAmount paid: $${Number(job.amountPaid || job.price || 0).toFixed(2)}\nAssigned providers: ${(job.providerIds || []).length}\n\nOpen the job:\n${ORIGIN}/dashboard/admin/jobs/${jobId}\n\nWont Stop Moving` });
}

/**
 * Sends the emails for a newly paid booking. Never throws: a mail problem must
 * not fail the payment confirmation that triggered it. Safe to call repeatedly;
 * each message is keyed, so it is created and sent at most once.
 */
export async function notifyPaidJob(jobId: string) {
  try { await queueJobEmails(jobId); } catch (error) { console.error('Paid booking emails failed', jobId, error); }
}
