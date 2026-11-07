import { randomInt, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { HttpError } from "./auth";
import { stripe } from "@/lib/stripe";

/**
 * Server-side job lifecycle. Jobs are created, confirmed and completed only
 * here. Release codes live in `jobSecrets/{jobId}`, which only the customer
 * and admins can read, never on the job document that providers can see.
 */

/** Providers keep 85% of what the customer paid; the marketplace fee is 15%. */
export const PROVIDER_SHARE = 0.85;
const MAX_CODE_ATTEMPTS = 5;

const newReleaseCode = () => String(randomInt(100000, 1000000));

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Marks a paid Stripe Checkout session's job as confirmed. Safe to call more
 * than once (from both the webhook and the customer's return page).
 */
export async function confirmPaidCheckout(session: Stripe.Checkout.Session): Promise<{ jobId: string | null }> {
  if (session.payment_status !== "paid") return { jobId: null };
  const md = session.metadata || {};
  const customerId = md.customerId;
  if (!customerId) throw new HttpError(400, "Payment is missing its customer.");

  const db = adminDb();
  const payment = {
    status: "confirmed",
    paymentStatus: "paid",
    checkoutSessionId: session.id,
    paymentIntentId: idOf(session.payment_intent as any),
    stripeCustomerId: idOf(session.customer as any),
    amountPaid: (session.amount_total || 0) / 100,
    paidAt: FieldValue.serverTimestamp(),
  };

  if (md.flow === "booking" && md.jobId) {
    const jobRef = db.doc(`jobs/${md.jobId}`);
    const secretRef = db.doc(`jobSecrets/${md.jobId}`);
    await db.runTransaction(async (tx) => {
      const [job, secret] = await Promise.all([tx.get(jobRef), tx.get(secretRef)]);
      if (!job.exists) throw new HttpError(404, "Booking not found.");
      const data = job.data()!;
      if (data.customerId !== customerId) throw new HttpError(403, "This payment belongs to another account.");
      if (data.checkoutSessionId && data.checkoutSessionId !== session.id) {
        throw new HttpError(409, "This booking was paid with a different checkout.");
      }
      if (data.paymentStatus === "paid") return;
      tx.update(jobRef, payment);
      if (!secret.exists) tx.set(secretRef, { customerId, releaseCode: newReleaseCode(), failedAttempts: 0 });
    });
    return { jobId: md.jobId };
  }

  if (md.quoteId) {
    const jobId = `job_quote_${md.quoteId}`;
    const quoteRef = db.doc(`quotes/${md.quoteId}`);
    const jobRef = db.doc(`jobs/${jobId}`);
    const secretRef = db.doc(`jobSecrets/${jobId}`);
    await db.runTransaction(async (tx) => {
      const [quote, job, secret] = await Promise.all([tx.get(quoteRef), tx.get(jobRef), tx.get(secretRef)]);
      if (!quote.exists) throw new HttpError(404, "Quote not found.");
      const q = quote.data()!;
      if (q.customerId !== customerId) throw new HttpError(403, "This payment belongs to another account.");
      if (job.exists && job.data()?.paymentStatus === "paid") return;
      let details: Record<string, any> = {};
      try {
        details = typeof q.details === "string" ? JSON.parse(q.details) : q.details || {};
      } catch {
        details = {};
      }
      tx.set(
        jobRef,
        {
          id: jobId,
          customerId,
          quoteId: md.quoteId,
          state: q.state || details.state || "California",
          moveDate: q.moveDate || details.moveDate || "",
          pickupAddress: q.pickupAddress || q.pickupZip || details.pickupZip || "",
          dropoffAddress: q.dropoffAddress || q.dropoffZip || details.dropoffZip || "",
          moveSize: md.moveSize || q.moveSize || details.moveSize || "studio",
          specialItems: q.specialItems || details.specialItems || "",
          price: payment.amountPaid,
          employeeIds: [],
          providerIds: q.preferredProviderId ? [q.preferredProviderId] : [],
          createdAt: FieldValue.serverTimestamp(),
          ...payment,
        },
        { merge: true }
      );
      tx.update(quoteRef, { status: "processed" });
      if (!secret.exists) tx.set(secretRef, { customerId, releaseCode: newReleaseCode(), failedAttempts: 0 });
    });
    return { jobId };
  }

  throw new HttpError(400, "Payment is missing its booking details.");
}

function codesMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type CompletionResult = {
  payoutStatus: "paid" | "needs_manual_payout";
  transferId: string | null;
};

/**
 * Completes a job when the assigned provider (or an admin) enters the
 * customer's release code, then pays the provider 85% of what the customer
 * actually paid, to the Stripe account stored on the provider's own record.
 */
export async function completeJobWithCode(params: {
  jobId: string;
  code: string;
  uid: string;
  isAdmin: boolean;
}): Promise<CompletionResult> {
  const { jobId, code, uid, isAdmin } = params;
  const db = adminDb();
  const jobRef = db.doc(`jobs/${jobId}`);
  const secretRef = db.doc(`jobSecrets/${jobId}`);

  const outcome = await db.runTransaction(async (tx) => {
    const [job, secret] = await Promise.all([tx.get(jobRef), tx.get(secretRef)]);
    if (!job.exists || !secret.exists) throw new HttpError(404, "Job not found.");
    const data = job.data()!;
    const providerIds: string[] = Array.isArray(data.providerIds) ? data.providerIds : [];
    if (!isAdmin && !providerIds.includes(uid)) throw new HttpError(403, "You are not assigned to this job.");
    if (data.paymentStatus !== "paid") throw new HttpError(409, "This job hasn't been paid for yet.");
    if (data.status === "completed" || data.status === "cancelled") {
      throw new HttpError(409, `This job is already ${data.status}.`);
    }
    const s = secret.data()!;
    const attempts = Number(s.failedAttempts || 0);
    if (attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(423, "Too many incorrect codes. Contact support to release this job.");
    }
    if (!codesMatch(String(s.releaseCode), code)) {
      tx.update(secretRef, { failedAttempts: attempts + 1 });
      return { ok: false as const, remaining: MAX_CODE_ATTEMPTS - attempts - 1 };
    }
    const payeeUid = isAdmin ? providerIds[0] : uid;
    tx.update(jobRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      completedBy: uid,
      payoutStatus: "processing",
      payeeProviderId: payeeUid || null,
    });
    return {
      ok: true as const,
      payeeUid,
      amountPaid: Number(data.amountPaid || 0),
      paymentIntentId: data.paymentIntentId as string | null,
    };
  });

  if (!outcome.ok) {
    throw new HttpError(
      400,
      outcome.remaining > 0
        ? `That code doesn't match. ${outcome.remaining} attempt${outcome.remaining === 1 ? "" : "s"} left.`
        : "Too many incorrect codes. Contact support to release this job."
    );
  }

  let transferId: string | null = null;
  try {
    const provider = outcome.payeeUid ? await db.doc(`providers/${outcome.payeeUid}`).get() : null;
    const accountId = provider?.data()?.stripeAccountId as string | undefined;
    const cents = Math.round(outcome.amountPaid * PROVIDER_SHARE * 100);
    if (accountId?.startsWith("acct_") && provider?.data()?.stripeOnboardingComplete && cents > 0) {
      let sourceTransaction: string | undefined;
      if (outcome.paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(outcome.paymentIntentId);
        sourceTransaction = idOf(pi.latest_charge as any) ?? undefined;
      }
      const transfer = await stripe.transfers.create(
        {
          amount: cents,
          currency: "usd",
          destination: accountId,
          transfer_group: `JOB_${jobId}`,
          description: `85% payout for job ${jobId}`,
          ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
          metadata: { jobId, providerId: outcome.payeeUid! },
        },
        { idempotencyKey: `payout-${jobId}` }
      );
      transferId = transfer.id;
    }
  } catch (error) {
    console.error(`Payout for job ${jobId} needs manual review:`, error);
  }

  const payoutStatus = transferId ? "paid" : "needs_manual_payout";
  await jobRef.update({ payoutStatus, payoutTransferId: transferId });
  return { payoutStatus, transferId };
}
