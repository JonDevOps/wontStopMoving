import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { activeInsuranceFor, authorityFor } from './fmcsa';
import { enqueueEmail } from './notifications';
import { EMPTY_PROFILE, EXPIRY_WARNING_DAYS, daysUntil, isBackgroundStatus, profileIssues, type MoverProfile } from '@/lib/mover-profile';

const iso = (v: any) => (typeof v === 'string' ? v : v?.toDate?.().toISOString() || null);

export async function getMoverProfile(uid: string): Promise<{ profile: MoverProfile; needsDot: boolean; stripeReady: boolean }> {
  const db = adminDb();
  const [c, p] = await Promise.all([db.doc(`providerCompliance/${uid}`).get(), db.doc(`providers/${uid}`).get()]);
  const d = c.data() || {};
  const provider = p.data() || {};
  const profile: MoverProfile = {
    ...EMPTY_PROFILE, ...d,
    backgroundStatus: isBackgroundStatus(d.backgroundStatus) ? d.backgroundStatus : 'not-started',
    backgroundConsentAt: iso(d.backgroundConsentAt),
    fmcsa: d.fmcsa ? { ...d.fmcsa, checkedAt: iso(d.fmcsa.checkedAt) } : null,
  } as MoverProfile;
  return { profile, needsDot: provider.hasDotVehicle === true, stripeReady: provider.stripeOnboardingComplete === true };
}

/** Looks the USDOT number up with FMCSA. Best effort: a failed lookup keeps the last result. */
export async function verifyWithFmcsa(uid: string, usdot: string) {
  try {
    const [auth, insurance] = await Promise.all([authorityFor(usdot), activeInsuranceFor(usdot)]);
    const fmcsa = { checkedAt: new Date().toISOString(), hhgAuthority: auth.some(a => a.hhg), activeAuthority: auth.some(a => a.common || a.contract), insuranceOnFile: insurance.length > 0 };
    await adminDb().doc(`providerCompliance/${uid}`).set({ fmcsa }, { merge: true });
    return fmcsa;
  } catch (error) { console.error('FMCSA check failed', uid, error); return null; }
}

/** Daily-ish: emails movers whose insurance expires within 30 days (once per expiry date), and flags blocking issues. Never throws. */
export async function runInsuranceReminders(now = Date.now()) {
  let reminded = 0;
  try {
    const db = adminDb();
    const snap = await db.collection('providerCompliance').where('insuranceExpires', '<=', new Date(now + EXPIRY_WARNING_DAYS * 86400000).toISOString().slice(0, 10)).limit(500).get();
    for (const doc of snap.docs) {
      const d = doc.data(), days = daysUntil(d.insuranceExpires, now);
      if (days === null || days < -30) continue;
      const user = (await db.doc(`users/${doc.id}`).get()).data();
      if (!user?.email) continue;
      await enqueueEmail(`insurance-expiry:${doc.id}:${d.insuranceExpires}`, {
        category: 'provider', referenceId: doc.id, to: user.email,
        subject: days < 0 ? 'Your insurance on file has expired' : `Your insurance expires in ${days} day${days === 1 ? '' : 's'}`,
        text: `Hi ${user.name || 'there'},\n\nThe insurance on your Wont Stop Moving profile ${days < 0 ? 'expired' : 'expires'} on ${d.insuranceExpires}. ${days < 0 ? 'New jobs are paused until you add your renewal.' : 'Add your renewal before then so your jobs aren’t paused.'}\n\nUpdate your profile: https://wontstopmoving.com/dashboard/provider/credentials\n\nWont Stop Moving`,
      });
      reminded++;
    }
  } catch (error) { console.error('Insurance reminders failed', error); }
  return { reminded };
}

export async function saveMoverProfile(uid: string, fields: Partial<MoverProfile>, consent: boolean) {
  const db = adminDb(), ref = db.doc(`providerCompliance/${uid}`);
  const current = (await ref.get()).data() || {};
  const consentNow = consent && (!current.backgroundStatus || current.backgroundStatus === 'not-started');
  await ref.set({
    ...fields, updatedAt: FieldValue.serverTimestamp(),
    ...(consentNow ? { backgroundStatus: 'consented', backgroundConsentAt: FieldValue.serverTimestamp() } : {}),
  }, { merge: true });
  if (consentNow) {
    await enqueueEmail(`background-consent:${uid}`, {
      category: 'provider', referenceId: uid, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
      subject: 'Mover consented to a background check',
      text: `A mover gave consent for their background check. Order it with your screening provider, then record the result:\nhttps://wontstopmoving.com/dashboard/admin/credentials\n\nWont Stop Moving`,
    }).catch(() => {});
  }
  const fresh = await getMoverProfile(uid);
  return { ...fresh, issues: profileIssues(fresh.profile, { needsDot: fresh.needsDot }) };
}
