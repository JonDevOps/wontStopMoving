// Firestore rules tests. Run with:
//   firebase emulators:exec --only firestore --project demo-wsm "npm run test:rules"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { TERMS_VERSION, TERMS_DOCUMENT_PATH, termsAcceptance } from '../src/lib/terms.ts';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wsm',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/boss'), { role: 'admin', email: 'boss@example.com' });
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/cust'), { role: 'customer', email: 'cust@example.com' });
    await setDoc(doc(db, 'users/prov'), { role: 'provider' });
    await setDoc(doc(db, 'users/crew'), { role: 'employee' });
    await setDoc(doc(db, 'providers/prov'), { status: 'approved', stripeAccountId: 'acct_real', rating: 4.8, reviewCount: 3, bio: 'hi' });
    await setDoc(doc(db, 'jobs/j1'), { customerId: 'cust', providerIds: ['prov'], employeeIds: ['crew'], status: 'confirmed', paymentStatus: 'paid', price: 500, amountPaid: 500 });
    await setDoc(doc(db, 'jobs/done'), { customerId: 'cust', providerIds: ['prov'], employeeIds: [], status: 'completed', paymentStatus: 'paid', amountPaid: 500 });
    await setDoc(doc(db, 'jobSecrets/j1'), { customerId: 'cust', releaseCode: '123456', failedAttempts: 0 });
  });
});

const as = (uid, token = {}) => env.authenticatedContext(uid, token).firestore();

test('custom quotes are private until claimed and their pricing and scope cannot be rewritten in browsers', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'quotes/custom'), { isCustomQuote: true, customerId: 'cust', status: 'new', description: 'Two movers', pricing: { type: 'fixed', total: 500 } });
    await setDoc(doc(ctx.firestore(), 'quotes/unclaimed'), { isCustomQuote: true, customerId: '', status: 'new' });
  });
  await assertSucceeds(getDoc(doc(as('cust'), 'quotes/custom')));
  await assertFails(getDoc(doc(as('prov'), 'quotes/custom')));
  await assertFails(getDoc(doc(as('cust'), 'quotes/unclaimed')));
  for (const uid of ['cust', 'boss']) {
    for (const change of [{ pricing: { type: 'fixed', total: 1 } }, { description: 'changed scope' }, { customerId: 'other' }, { isCustomQuote: false }]) await assertFails(updateDoc(doc(as(uid), 'quotes/custom'), change));
    await assertFails(setDoc(doc(as(uid), 'quotes/forged'), { customerId: uid, status: 'new', isCustomQuote: true, pricing: { type: 'fixed', total: 1 }, termsAcceptance: termsAcceptance(uid, 'quote', serverTimestamp()) }));
  }
  await assertSucceeds(updateDoc(doc(as('boss'), 'quotes/custom'), { status: 'expired' }));
});

test('a new signup cannot make itself admin with the old invite flag', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/mallory'), { role: 'admin', adminInviteVerified: true }));
});

test('a new signup using the admin@ email cannot make itself admin', async () => {
  const db = as('m2', { email: 'admin@wontstopmoving.com', email_verified: true });
  await assertFails(setDoc(doc(db, 'users/m2'), { role: 'admin' }));
});

test('normal signups still work for customer, employee and provider', async () => {
  for (const role of ['customer', 'employee', 'provider']) {
    const uid = `u-${role}`;
    await assertSucceeds(setDoc(doc(as(uid), `users/${uid}`), { role, ...(role === 'customer' ? { termsAcceptance: termsAcceptance(uid, 'signup', serverTimestamp()) } : {}) }));
  }
});

test('customer signup requires explicit current terms with a Firebase-generated timestamp', async () => {
  const uid = 'terms-signup';
  const db = as(uid);
  const valid = () => termsAcceptance(uid, 'signup', serverTimestamp());
  await assertFails(setDoc(doc(db, `users/${uid}`), { role: 'customer' }));
  for (const change of [{ accepted: false }, { version: 'old-version' }, { documentPath: '/terms/old' }, { acceptedBy: 'someone-else' }, { context: 'quote' }, { acceptedAt: Timestamp.fromMillis(0) }]) {
    await assertFails(setDoc(doc(db, `users/${uid}`), { role: 'customer', termsAcceptance: { ...valid(), ...change } }));
  }
  await assertSucceeds(setDoc(doc(db, `users/${uid}`), { role: 'customer', termsAcceptance: valid() }));
  const saved = (await getDoc(doc(db, `users/${uid}`))).data().termsAcceptance;
  assertCurrentAgreement(saved, uid, 'signup');
  for (const client of [db, as('boss')]) {
    await assertFails(updateDoc(doc(client, `users/${uid}`), { 'termsAcceptance.accepted': false }));
  }
  await assertSucceeds(updateDoc(doc(db, `users/${uid}`), { name: 'Updated name' }));
});

function assertCurrentAgreement(saved, uid, context) {
  if (saved.version !== TERMS_VERSION || saved.documentPath !== TERMS_DOCUMENT_PATH || saved.acceptedBy !== uid || saved.context !== context || saved.accepted !== true || Math.abs(Date.now() - saved.acceptedAt.toMillis()) > 30000) {
    throw new Error('Agreement metadata was not stored with the current version and server timestamp.');
  }
}

test('a user cannot change their own role to admin', async () => {
  await assertFails(updateDoc(doc(as('cust'), 'users/cust'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(as('cust'), 'users/cust'), { name: 'New name' }));
});

test('an existing admin can grant admin', async () => {
  await assertSucceeds(setDoc(doc(as('boss'), 'users/newadmin'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(as('boss'), 'users/cust'), { role: 'admin' }));
});

test('only admins can list users', async () => {
  await assertFails(getDocs(collection(as('cust'), 'users')));
  await assertSucceeds(getDocs(collection(as('boss'), 'users')));
});

test('support tickets and intake counters cannot be read or written directly by browser clients', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'supportTickets/private'), { email: 'private@example.com', message: 'Private enquiry' });
    await setDoc(doc(ctx.firestore(), 'supportIntakeLimits/private'), { count: 1 });
  });
  for (const db of [env.unauthenticatedContext().firestore(), as('cust'), as('prov'), as('crew'), as('boss')]) {
    await assertFails(getDoc(doc(db, 'supportTickets/private')));
    await assertFails(getDocs(collection(db, 'supportTickets')));
    await assertFails(setDoc(doc(db, 'supportTickets/injected'), { message: 'Bypass intake' }));
    await assertFails(updateDoc(doc(db, 'supportTickets/private'), { status: 'resolved' }));
    await assertFails(getDoc(doc(db, 'supportIntakeLimits/private')));
    await assertFails(setDoc(doc(db, 'supportIntakeLimits/private'), { count: 0 }));
  }
});

test('per-checkout agreement receipts are private and server-managed', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'checkoutTerms/private'), { customerId: 'cust', quoteId: 'q', termsAcceptance: { accepted: true } });
  });
  for (const db of [env.unauthenticatedContext().firestore(), as('cust'), as('prov'), as('boss')]) {
    await assertFails(getDoc(doc(db, 'checkoutTerms/private')));
    await assertFails(getDocs(collection(db, 'checkoutTerms')));
    await assertFails(setDoc(doc(db, 'checkoutTerms/forged'), { customerId: 'cust' }));
    await assertFails(updateDoc(doc(db, 'checkoutTerms/private'), { 'termsAcceptance.accepted': false }));
  }
});

test('only the customer and admins can read a release code; providers cannot', async () => {
  await assertSucceeds(getDoc(doc(as('cust'), 'jobSecrets/j1')));
  await assertSucceeds(getDoc(doc(as('boss'), 'jobSecrets/j1')));
  await assertFails(getDoc(doc(as('prov'), 'jobSecrets/j1')));
  await assertFails(getDoc(doc(as('crew'), 'jobSecrets/j1')));
  await assertFails(setDoc(doc(as('cust'), 'jobSecrets/j1'), { customerId: 'cust', releaseCode: '000000' }));
});

test('nobody but admins can create jobs from the browser', async () => {
  await assertFails(setDoc(doc(as('cust'), 'jobs/fake'), { customerId: 'cust', status: 'confirmed', paymentStatus: 'paid', price: 1 }));
  await assertSucceeds(setDoc(doc(as('boss'), 'jobs/admin-made'), { customerId: 'cust', status: 'pending_payment' }));
});

test('customers cannot change price, status or payment on their job', async () => {
  for (const change of [{ price: 1 }, { status: 'completed' }, { paymentStatus: 'paid' }, { providerIds: ['cust'] }]) {
    await assertFails(updateDoc(doc(as('cust'), 'jobs/j1'), change));
  }
  await assertSucceeds(updateDoc(doc(as('cust'), 'jobs/j1'), { reviewed: true }));
});

test('providers can only toggle confirmed/in-progress, never complete or reprice', async () => {
  await assertSucceeds(updateDoc(doc(as('prov'), 'jobs/j1'), { status: 'in-progress' }));
  await assertFails(updateDoc(doc(as('prov'), 'jobs/j1'), { status: 'completed' }));
  await assertFails(updateDoc(doc(as('prov'), 'jobs/j1'), { price: 9999 }));
  await assertFails(updateDoc(doc(as('prov'), 'jobs/j1'), { payoutStatus: 'paid' }));
});

test('crew can save notes but cannot complete a job', async () => {
  await assertSucceeds(updateDoc(doc(as('crew'), 'jobs/j1'), { employeeNotes: 'ok', crewStatus: 'Delivered' }));
  await assertFails(updateDoc(doc(as('crew'), 'jobs/j1'), { status: 'completed' }));
});

test('providers cannot change their payout account, approval or rating', async () => {
  for (const change of [{ stripeAccountId: 'acct_attacker' }, { status: 'suspended' }, { rating: 5 }, { reviewCount: 99 }, { stripeOnboardingComplete: true }]) {
    await assertFails(updateDoc(doc(as('prov'), 'providers/prov'), change));
  }
  await assertSucceeds(updateDoc(doc(as('prov'), 'providers/prov'), { bio: 'Updated bio' }));
  await assertFails(setDoc(doc(as('new-prov'), 'providers/new-prov'), { status: 'pending', stripeAccountId: 'acct_x' }));
  await assertSucceeds(setDoc(doc(as('new-prov'), 'providers/new-prov'), { status: 'pending', rating: 0, reviewCount: 0 }));
  await assertFails(updateDoc(doc(as('new-prov'), 'providers/new-prov'), { status: 'approved' }));
});

test('a Google provider with an unfinished application can complete it without touching approval', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/g-prov'), { id: 'g-prov', role: 'provider', email: 'g@example.com' });
    await setDoc(doc(ctx.firestore(), 'providers/g-prov'), { uid: 'g-prov', status: 'pending', rating: 0, reviewCount: 0, services: ['moving'] });
  });
  const db = as('g-prov');
  await assertSucceeds(setDoc(doc(db, 'users/g-prov'), { phone: '4155550100', role: 'provider', state: 'CA' }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, 'providers/g-prov'), { phone: '4155550100', businessName: 'G Movers', termsAccepted: true, onboardingStep: 2 }, { merge: true }));
  await assertFails(setDoc(doc(db, 'providers/g-prov'), { status: 'approved', onboardingStep: 2 }, { merge: true }));
  await assertFails(setDoc(doc(db, 'users/g-prov'), { role: 'admin' }, { merge: true }));
});

test('reviews: only the customer of a completed job, once', async () => {
  const review = { jobId: 'done', customerId: 'cust', rating: 5, comment: 'Great' };
  await assertFails(setDoc(doc(as('prov'), 'providers/prov/reviews/done'), { ...review, customerId: 'prov' }));
  await assertFails(setDoc(doc(as('cust'), 'providers/prov/reviews/j1'), { ...review, jobId: 'j1' }));
  await assertFails(addDoc(collection(as('cust'), 'providers/prov/reviews'), review));
  await assertSucceeds(setDoc(doc(as('cust'), 'providers/prov/reviews/done'), review));
  await assertFails(setDoc(doc(as('cust'), 'providers/prov/reviews/done'), { ...review, rating: 1 }));
});

test('quotes: only for yourself, starting as new; no reassigning or status changes', async () => {
  await assertFails(addDoc(collection(env.unauthenticatedContext().firestore(), 'quotes'), { customerId: 'cust', status: 'new' }));
  await assertFails(addDoc(collection(as('prov'), 'quotes'), { customerId: 'cust', status: 'new' }));
  await assertFails(setDoc(doc(as('cust'), 'quotes/q1'), { customerId: 'cust', status: 'processed' }));
  await assertSucceeds(setDoc(doc(as('cust'), 'quotes/q1'), { customerId: 'cust', status: 'new', moveSize: '2br', termsAcceptance: termsAcceptance('cust', 'quote', serverTimestamp()) }));
  await assertSucceeds(updateDoc(doc(as('cust'), 'quotes/q1'), { moveSize: '3br' }));
  await assertFails(updateDoc(doc(as('cust'), 'quotes/q1'), { status: 'processed' }));
  // Lead tracking is server-only: customers can't mark their own lead contacted, assigned or lost.
  for (const change of [{ leadStatus: 'lost' }, { assignedTo: 'cust' }, { firstContactAt: serverTimestamp() }, { leadNotifiedAt: serverTimestamp() }, { followUpsStopped: false }, { followUpStep: 0 }, { followUpToken: 'x' }, { referralCode: 'ABCD2345' }, { leadSource: { utmSource: 'x' } }]) await assertFails(updateDoc(doc(as('cust'), 'quotes/q1'), change));
  await assertFails(updateDoc(doc(as('cust'), 'quotes/q1'), { customerId: 'prov' }));
  for (const change of [{ paymentStatus: 'paid' }, { checkoutSessionId: 'cs_forged' }, { paymentFailedAt: 'forged' }, { bookingTermsAcceptance: { accepted: true } }]) {
    await assertFails(updateDoc(doc(as('cust'), 'quotes/q1'), change));
    await assertFails(setDoc(doc(as('cust'), 'quotes/q-new'), { customerId: 'cust', status: 'new', ...change }));
  }
});

test('customer quotes reject missing or forged agreement metadata and preserve acceptance on edits', async () => {
  const db = as('cust');
  const ref = doc(db, 'quotes/terms-quote');
  const quote = { customerId: 'cust', status: 'new', moveSize: 'studio' };
  await assertFails(setDoc(ref, quote));
  for (const change of [{ accepted: false }, { version: 'old-version' }, { acceptedBy: 'boss' }, { context: 'signup' }, { acceptedAt: Timestamp.fromMillis(0) }]) {
    await assertFails(setDoc(ref, { ...quote, termsAcceptance: { ...termsAcceptance('cust', 'quote', serverTimestamp()), ...change } }));
  }
  await assertSucceeds(setDoc(ref, { ...quote, termsAcceptance: termsAcceptance('cust', 'quote', serverTimestamp()) }));
  assertCurrentAgreement((await getDoc(ref)).data().termsAcceptance, 'cust', 'quote');
  for (const client of [db, as('boss')]) {
    await assertFails(updateDoc(doc(client, 'quotes/terms-quote'), { 'termsAcceptance.version': 'rewritten' }));
  }
  await assertSucceeds(updateDoc(ref, { phone: '6505550100' }));
});

test('browser admins cannot invent another customer agreement or rewrite a booking agreement', async () => {
  const boss = as('boss');
  await assertFails(setDoc(doc(boss, 'users/forged-customer'), { role: 'customer', termsAcceptance: termsAcceptance('forged-customer', 'signup', serverTimestamp()) }));
  await assertFails(setDoc(doc(boss, 'quotes/forged-consent'), { customerId: 'cust', status: 'new', termsAcceptance: termsAcceptance('cust', 'quote', serverTimestamp()) }));
  await assertFails(setDoc(doc(boss, 'jobs/forged-consent'), { customerId: 'cust', termsAcceptance: termsAcceptance('cust', 'booking', serverTimestamp()) }));
  // Staff can still create a lead without pretending that its customer agreed.
  await assertSucceeds(setDoc(doc(boss, 'quotes/staff-lead'), { customerId: 'cust', status: 'new' }));
  await env.withSecurityRulesDisabled(async ctx => {
    await updateDoc(doc(ctx.firestore(), 'jobs/j1'), { termsAcceptance: termsAcceptance('cust', 'booking', Timestamp.now()) });
  });
  await assertFails(updateDoc(doc(boss, 'jobs/j1'), { 'termsAcceptance.version': 'rewritten' }));
  await assertSucceeds(updateDoc(doc(boss, 'jobs/j1'), { employeeIds: ['crew'] }));
});

test('job chat: participants post only as themselves', async () => {
  await assertSucceeds(addDoc(collection(as('prov'), 'jobs/j1/messages'), { senderId: 'prov', text: 'On my way' }));
  await assertFails(addDoc(collection(as('prov'), 'jobs/j1/messages'), { senderId: 'cust', text: 'Fake' }));
  await assertFails(addDoc(collection(as('other'), 'jobs/j1/messages'), { senderId: 'other', text: 'Not on this job' }));
});

test('agent, competitor and admin-invite records are server-only, and nobody can sign themselves up as an agent', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'agents/ag1'), { status: 'pending', companyName: 'X' });
    await setDoc(doc(ctx.firestore(), 'competitors/c1'), { name: 'Rival' });
    await setDoc(doc(ctx.firestore(), 'adminInvites/x@example.com'), { status: 'pending' });
  });
  for (const path of ['agents/ag1', 'competitors/c1', 'adminInvites/x@example.com', 'agentProspects/p1', 'competitorSettings/us']) {
    await assertFails(getDoc(doc(as('ag1'), path)));
    await assertFails(setDoc(doc(as('ag1'), path), { status: 'approved' }));
  }
  await assertFails(getDoc(doc(as('boss'), 'agents/ag1'))); // Even admins go through the server API.
  await assertFails(setDoc(doc(as('self-agent'), 'users/self-agent'), { role: 'agent' }));
  await assertFails(setDoc(doc(as('x-user'), 'adminInvites/x-user@example.com'), { status: 'pending' }));
});

test('the move change log is server-only', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'jobs/logjob'), { customerId: 'cust', employeeIds: ['crew1'], status: 'confirmed' });
    await setDoc(doc(ctx.firestore(), 'jobs/logjob/changes/c1'), { by: 'Admin' });
  });
  await assertFails(getDoc(doc(as('cust'), 'jobs/logjob/changes/c1')));
  await assertFails(setDoc(doc(as('crew1'), 'jobs/logjob/changes/c2'), { by: 'me' }));
  await assertFails(updateDoc(doc(as('crew1'), 'jobs/logjob'), { moveDate: '2027-01-01' })); // Edits go through the server.
});
