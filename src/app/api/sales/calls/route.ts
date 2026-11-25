import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { CALL_TYPES, DISPOSITIONS, SERVICES } from '@/lib/sales-playbook';
import { MOVE_PRICING, ADDON_PRICING, calculateMoveTotal } from '@/lib/pricing';
import { zipRoadMiles } from '@/lib/server/distance';
import { markLeadContacted } from '@/lib/server/leads';

/**
 * Sales and service call log (`salesCalls`, server-only). Reps (employees)
 * and admins log each call with its outcome and an optional follow-up date;
 * the follow-up queue shows what's due. Reps see their own calls; admins see
 * everyone's.
 */
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const iso = (v: any) => v?.toDate?.().toISOString() || null;

type Answers = Record<string, { label: string; answer: string }>;
const cleanAnswers = (raw: unknown): Answers => {
  if (!raw || typeof raw !== 'object') return {};
  const out: Answers = {};
  for (const [id, v] of Object.entries(raw as Record<string, any>).slice(0, 60)) {
    const answer = str(v?.answer, 1000);
    if (/^[\w-]{1,80}$/.test(id) && answer) out[id] = { label: str(v?.label, 160), answer };
  }
  return out;
};

/** The account a call is about: the lead's customer, or a user with that email (#123). */
async function findCustomer(db: FirebaseFirestore.Firestore, leadId: unknown, email: string, phone: string) {
  if (isId(leadId)) {
    const cid = (await db.doc(`quotes/${leadId}`).get()).data()?.customerId;
    if (isId(cid)) return cid;
  }
  if (email) {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  if (phone) {
    const snap = await db.collection('users').where('phone', '==', phone).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  return null;
}

const callSummary = (id: string, c: FirebaseFirestore.DocumentData) => ({
  id, createdAt: iso(c.createdAt), repName: c.repName || 'Rep', callType: c.callType, disposition: c.disposition,
  notes: c.notes || '', answers: (c.answers || {}) as Answers, estimatedTotal: c.estimatedTotal ?? null,
});

/** Customer on file for the sales script, and their past calls (#123). */
async function lookup(db: FirebaseFirestore.Firestore, params: URLSearchParams) {
  const email = str(params.get('email'), 254).toLowerCase(), phone = str(params.get('phone'), 40);
  const customerId = isId(params.get('customerId')) ? params.get('customerId')! : await findCustomer(db, params.get('leadId'), email, phone);
  const profile = customerId ? (await db.doc(`users/${customerId}`).get()).data() : null;
  const byId = customerId ? await db.collection('salesCalls').where('customerId', '==', customerId).limit(50).get() : null;
  const byEmail = email ? await db.collection('salesCalls').where('customerEmail', '==', email).limit(50).get() : null;
  // Past calls about this customer from every rep, so whoever calls next has the context.
  const seen = new Map<string, ReturnType<typeof callSummary>>();
  for (const d of [...(byId?.docs || []), ...(byEmail?.docs || [])]) seen.set(d.id, callSummary(d.id, d.data()));
  const calls = [...seen.values()]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 20);
  let quotes = 0, jobs = 0;
  if (customerId) {
    [quotes, jobs] = await Promise.all([
      db.collection('quotes').where('customerId', '==', customerId).count().get().then(r => r.data().count),
      db.collection('jobs').where('customerId', '==', customerId).count().get().then(r => r.data().count),
    ]);
  }
  return {
    customer: profile ? { id: customerId, name: profile.name || '', email: profile.email || '', phone: profile.phone || '', state: profile.state || '', role: profile.role || 'customer', quotes, jobs } : null,
    calls,
  };
}

export async function GET(req: Request) {
  try {
    const { user, role } = await requireRole(req, ['employee', 'admin']);
    const params = new URL(req.url).searchParams;
    if (params.get('lookup') === '1') return NextResponse.json(await lookup(adminDb(), params), { headers: { 'Cache-Control': 'private, no-store' } });
    let q = adminDb().collection('salesCalls').where('followUpOpen', '==', true);
    if (role !== 'admin') q = q.where('repId', '==', user.uid);
    const snap = await q.orderBy('followUpAt', 'asc').limit(100).get();
    const followUps = snap.docs.map(d => {
      const c = d.data();
      return { id: d.id, customerName: c.customerName, customerPhone: c.customerPhone, customerEmail: c.customerEmail, callType: c.callType, service: c.service, disposition: c.disposition, estimatedTotal: c.estimatedTotal, notes: c.notes, repName: c.repName, followUpAt: iso(c.followUpAt), createdAt: iso(c.createdAt) };
    });
    return NextResponse.json({ followUps }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { user, role } = await requireRole(req, ['employee', 'admin']);
    const body = await readJson(req);
    const db = adminDb();

    if (body.action === 'done') {
      if (!isId(body.id)) throw new HttpError(400, 'Choose a call.');
      const ref = db.doc(`salesCalls/${body.id}`);
      await db.runTransaction(async tx => {
        const c = (await tx.get(ref)).data();
        if (!c) throw new HttpError(404, 'Call not found.');
        if (role !== 'admin' && c.repId !== user.uid) throw new HttpError(403, 'That follow-up belongs to another rep.');
        tx.update(ref, { followUpOpen: false, followUpDoneAt: FieldValue.serverTimestamp(), followUpDoneBy: user.uid });
      });
      return NextResponse.json({ done: true });
    }

    // action: 'log'
    if (!CALL_TYPES.some(t => t.id === body.callType)) throw new HttpError(400, 'Choose a call type.');
    if (!SERVICES.some(s => s.id === body.service)) throw new HttpError(400, 'Choose a service.');
    const disposition = DISPOSITIONS.find(d => d.id === body.disposition);
    if (!disposition) throw new HttpError(400, 'Choose the call outcome.');
    const customerName = str(body.customerName, 120);
    const customerPhone = str(body.customerPhone, 40);
    const customerEmail = str(body.customerEmail, 254).toLowerCase();
    if (!customerName || (!customerPhone && !customerEmail)) throw new HttpError(400, 'Add the customer’s name and a phone number or email.');
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new HttpError(400, 'Check the email address.');
    let followUpAt: Timestamp | null = null;
    if (body.followUpAt) {
      const when = Date.parse(String(body.followUpAt));
      if (Number.isNaN(when) || when > Date.now() + 366 * 86400000) throw new HttpError(400, 'Choose a follow-up date within the next year.');
      followUpAt = Timestamp.fromMillis(when);
    }
    if (disposition.needsFollowUp && !followUpAt) throw new HttpError(400, 'Set a follow-up date for this outcome.');
    const moveSize = typeof body.moveSize === 'string' && MOVE_PRICING[body.moveSize] ? body.moveSize : null;
    const addOns = Array.isArray(body.addOns) ? body.addOns.filter((a: unknown): a is string => typeof a === 'string' && a in ADDON_PRICING).slice(0, 10) : [];
    const discounts = { isStudent: body.isStudent === true, isMilitary: body.isMilitary === true, isExpress: body.isExpress === true };
    // The quoted total is recalculated here, never trusted from the browser.
    const zipIn = (v: unknown) => (String(v || '').match(/\b\d{5}\b/g) || []).pop() || '';
    const miles = zipRoadMiles(zipIn(body.pickup), zipIn(body.dropoff));
    const estimatedTotal = moveSize ? calculateMoveTotal(moveSize, addOns, { ...discounts, miles }) : null;
    const rep = (await db.doc(`users/${user.uid}`).get()).data();
    const answers = cleanAnswers(body.answers);
    const customerId = await findCustomer(db, body.leadId, customerEmail, customerPhone);

    const ref = await db.collection('salesCalls').add({
      repId: user.uid, repName: str(rep?.name, 120) || user.email || 'Rep',
      callType: body.callType, service: body.service, disposition: disposition.id,
      customerName, customerPhone, customerEmail,
      pickup: str(body.pickup, 200), dropoff: str(body.dropoff, 200), moveDate: str(body.moveDate, 20),
      moveSize, addOns, ...discounts, estimatedTotal,
      notes: str(body.notes, 4000), checklistProgress: str(body.checklistProgress, 20), answers, customerId,
      followUpAt, followUpOpen: !!followUpAt && disposition.id !== 'do-not-call',
      doNotCall: disposition.id === 'do-not-call',
      leadId: isId(body.leadId) ? body.leadId : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    // A call about a lead counts as contacting it (and starts its response time).
    if (isId(body.leadId)) {
      try {
        await markLeadContacted(db, body.leadId, user.uid);
        // The call's notes and answers also show on the lead in the inbox.
        const answered = Object.values(answers).map(a => `${a.label}: ${a.answer}`).join('\n');
        const text = [str(body.notes, 4000), answered].filter(Boolean).join('\n\n');
        if (text) await db.doc(`quotes/${body.leadId}`).update({ leadNotes: FieldValue.arrayUnion({ text: `Call (${disposition.label || disposition.id}): ${text}`.slice(0, 2000), by: user.uid, byName: str(rep?.name, 120) || user.email || 'Rep', at: Date.now() }) });
        // No more automatic reminders once the customer has booked or said no.
        if (['booked', 'not-interested', 'do-not-call'].includes(disposition.id)) {
          await db.doc(`quotes/${body.leadId}`).update({ followUpsStopped: true, followUpsStoppedReason: disposition.id, followUpsStoppedAt: FieldValue.serverTimestamp() });
        }
      } catch (error) { console.error('Could not update lead', body.leadId, error); }
    }
    return NextResponse.json({ id: ref.id, estimatedTotal }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
