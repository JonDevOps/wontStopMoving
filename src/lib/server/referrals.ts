import { randomInt } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { enqueueEmail } from './notifications';

/**
 * Referral program. Each customer has a code (`referralCodes/{code}` → uid);
 * their link is wontstopmoving.com/quote?ref=CODE. When a referred customer's
 * quote is paid, a reward is recorded in `referrals/{jobId}` (one per booking)
 * for the team to issue. Self-referrals don't count.
 */
export const REFERRAL_REWARD_USD = Number(process.env.REFERRAL_REWARD_USD || 25);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O or 1/I confusion.
const ORIGIN = 'https://wontstopmoving.com';

export async function getOrCreateReferralCode(uid: string): Promise<string> {
  const db = adminDb(), userRef = db.doc(`users/${uid}`);
  const existing = (await userRef.get()).data()?.referralCode;
  if (typeof existing === 'string' && /^[A-Z0-9]{6,12}$/.test(existing)) return existing;
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    try {
      await db.runTransaction(async tx => {
        const codeRef = db.doc(`referralCodes/${code}`);
        if ((await tx.get(codeRef)).exists) throw new Error('taken');
        tx.create(codeRef, { uid, createdAt: FieldValue.serverTimestamp() });
        tx.set(userRef, { referralCode: code }, { merge: true });
      });
      return code;
    } catch (error) { if ((error as Error).message !== 'taken') throw error; }
  }
  throw new Error('Could not create a referral code.');
}

export const referralLink = (code: string) => `${ORIGIN}/quote?ref=${code}`;

/** Records the referral reward for a paid quote. Never throws. */
export async function recordReferralForPaidQuote(quoteId: string, jobId: string) {
  try {
    const db = adminDb();
    const q = (await db.doc(`quotes/${quoteId}`).get()).data();
    const code = q?.referralCode;
    if (typeof code !== 'string' || !/^[A-Z0-9]{6,12}$/.test(code)) return;
    const referrerUid = (await db.doc(`referralCodes/${code}`).get()).data()?.uid;
    if (!referrerUid || referrerUid === q?.customerId) return;
    const ref = db.doc(`referrals/${jobId}`);
    const created = await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return false;
      tx.create(ref, { referrerUid, referredCustomerId: q?.customerId || null, referredName: q?.name || null, quoteId, jobId, code, amountUsd: REFERRAL_REWARD_USD, status: 'earned', createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!created) return;
    const referrer = (await db.doc(`users/${referrerUid}`).get()).data();
    if (referrer?.email) {
      await enqueueEmail(`referral-earned:${jobId}`, {
        category: 'referral', referenceId: jobId, to: referrer.email,
        subject: `You earned a $${REFERRAL_REWARD_USD} referral reward`,
        text: `Hi ${referrer.name || 'there'},\n\nSomeone you referred just booked their move with Wont Stop Moving. Thank you! You've earned a $${REFERRAL_REWARD_USD} reward, and our team will be in touch to send it.\n\nKeep sharing your link:\n${referralLink(code)}\n\nWont Stop Moving`,
      });
    }
  } catch (error) {
    console.error('Referral reward failed', quoteId, error);
  }
}
