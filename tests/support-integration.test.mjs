import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, applyActionCode, reload } from 'firebase/auth';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import Stripe from 'stripe';
import { supportInquirySchema } from '../src/lib/support.ts';
import { sendSignupVerification } from '../src/lib/email-verification.ts';
import { syncConnectedAccountStatus } from '../src/lib/server/connect-status.ts';

const base = process.env.SUPPORT_TEST_BASE_URL;
if (!base?.startsWith('http://127.0.0.1:') || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('These tests require local emulators and the integration runner.');
}
const projectId = 'demo-wsm';
let adminApp, db, app, auth, adminToken, adminPasswordOnlyToken, customerToken;
const inquiry = { name: 'Test Customer', email: 'contact-test@example.com', phone: '', subject: 'Test enquiry', message: 'Please help me plan my upcoming move.' };
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

before(async () => {
  adminApp = initializeAdmin({ projectId }, 'support-tests');
  db = getFirestore(adminApp);
  app = initializeApp({ projectId, apiKey: 'fake-api-key', authDomain: `${projectId}.firebaseapp.com` }, 'support-tests');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const admin = (await createUserWithEmailAndPassword(auth, 'test-admin@example.com', 'test-only-password')).user;
  await db.doc(`users/${admin.uid}`).set({ role: 'admin', twoFactorEnabled: true });
  adminPasswordOnlyToken = await admin.getIdToken();
  await getAdminAuth(adminApp).updateUser(admin.uid, { emailVerified: true });
  await reload(admin);
  const idToken = await admin.getIdToken(true);
  // Auth emulator supports SMS MFA, but not TOTP. Exercise genuine Firebase
  // second-factor tokens here; production TOTP has a separate smoke check.
  const authBase = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
  const start = await (await fetch(`${authBase}/identitytoolkit.googleapis.com/v2/accounts/mfaEnrollment:start?key=fake-api-key`, json({ idToken, phoneEnrollmentInfo: { phoneNumber: '+16505550199' } }))).json();
  assert.ok(start.phoneSessionInfo?.sessionInfo);
  const codes = await (await fetch(`${authBase}/emulator/v1/projects/${projectId}/verificationCodes`)).json();
  const code = codes.verificationCodes.find(item => item.sessionInfo === start.phoneSessionInfo.sessionInfo)?.code;
  assert.ok(code);
  const enrolled = await (await fetch(`${authBase}/identitytoolkit.googleapis.com/v2/accounts/mfaEnrollment:finalize?key=fake-api-key`, json({ idToken, displayName: 'Test MFA', phoneVerificationInfo: { sessionInfo: start.phoneSessionInfo.sessionInfo, code } }))).json();
  assert.ok(enrolled.idToken);
  adminToken = enrolled.idToken;
  const customer = (await createUserWithEmailAndPassword(auth, 'test-customer@example.com', 'test-only-password')).user;
  await db.doc(`users/${customer.uid}`).set({ role: 'customer' });
  customerToken = await customer.getIdToken();
});
after(async () => { await deleteApp(app); await deleteAdmin(adminApp); });

test('intake schema rejects malformed, oversized and privileged input', () => {
  for (const input of [{ ...inquiry, email: 'invalid' }, { ...inquiry, message: 'x'.repeat(5001) }, { ...inquiry, name: ' ' }, { ...inquiry, status: 'resolved' }]) {
    assert.equal(supportInquirySchema.safeParse(input).success, false);
  }
});

test('intake validates origin, body size, honeypot and invalid input', async () => {
  assert.equal((await fetch(`${base}/api/support`, json({ ...inquiry, email: 'invalid' }))).status, 400);
  assert.equal((await fetch(`${base}/api/support`, json({ ...inquiry, website: 'spam' }))).status, 400);
  assert.equal((await fetch(`${base}/api/support`, { ...json(inquiry), headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/support`, json({ message: 'x'.repeat(33000) }))).status, 413);
});

test('enquiry persists, only admins can read it, and status updates preserve the original message', async () => {
  const response = await fetch(`${base}/api/support`, json(inquiry));
  assert.equal(response.status, 201);
  const { ticketId } = await response.json();
  const original = (await db.doc(`supportTickets/${ticketId}`).get()).data();
  assert.equal(original.message, inquiry.message);
  assert.equal(original.status, 'new');
  assert.ok(original.createdAt.toMillis());
  assert.equal('website' in original, false);
  assert.equal((await fetch(`${base}/api/admin/support`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/support`, { headers: { Authorization: `Bearer ${adminPasswordOnlyToken}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/support`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const listed = await fetch(`${base}/api/admin/support`, { headers });
  assert.equal(listed.status, 200);
  assert.match(listed.headers.get('cache-control'), /no-store/);
  assert.ok((await listed.json()).tickets.some(t => t.id === ticketId));
  for (const [token, status] of [[customerToken, 403], [adminPasswordOnlyToken, 403], [adminToken, 200]]) {
    const update = await fetch(`${base}/api/admin/support/${ticketId}`, { method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'resolved', message: 'tampered' }) });
    assert.equal(update.status, status);
  }
  const saved = (await db.doc(`supportTickets/${ticketId}`).get()).data();
  assert.equal(saved.status, 'resolved');
  assert.equal(saved.message, inquiry.message);
  assert.equal((await fetch(`${base}/api/admin/support/${ticketId}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'invalid' }) })).status, 400);
});

test('concurrent intake cannot exceed five messages per email in an hour', async () => {
  const results = await Promise.all(Array.from({ length: 7 }, () => fetch(`${base}/api/support`, json({ ...inquiry, email: 'rate-test@example.com' }))));
  assert.equal(results.filter(r => r.status === 201).length, 5);
  assert.equal(results.filter(r => r.status === 429).length, 2);
});

test('signup helper sends a working verification link through Firebase Auth', async () => {
  const user = auth.currentUser;
  assert.equal(user.emailVerified, false);
  assert.equal(await sendSignupVerification(user), true);
  const codes = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/oobCodes`)).json();
  const verification = codes.oobCodes.find(code => code.email === user.email && code.requestType === 'VERIFY_EMAIL');
  assert.ok(verification);
  await applyActionCode(auth, verification.oobCode);
  await reload(user);
  assert.equal(user.emailVerified, true);
});

const stripe = new Stripe('sk_test_placeholder_key_required');
async function webhook(event, valid = true) {
  const body = JSON.stringify({ livemode: false, ...event });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: valid ? 'whsec_integration_test' : 'whsec_wrong' });
  return fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body });
}

test('webhook rejects invalid signatures and never fulfils unpaid sessions', async () => {
  const event = { id: 'evt_test_unpaid', type: 'checkout.session.completed', data: { object: { id: 'cs_test_unpaid', payment_status: 'unpaid' } } };
  assert.equal((await webhook(event, false)).status, 400);
  assert.equal((await webhook(event)).status, 200);
});

test('paid checkout webhook confirms the booking once even with concurrent retries', async () => {
  const ref = db.doc('jobs/webhook-test');
  await ref.set({ customerId: 'test-buyer', status: 'pending_payment', paymentStatus: 'unpaid', price: 100 });
  const event = { id: 'evt_test_paid', type: 'checkout.session.completed', data: { object: {
    id: 'cs_test_paid', payment_status: 'paid', amount_total: 10000, payment_intent: 'pi_test',
    metadata: { flow: 'booking', jobId: 'webhook-test', customerId: 'test-buyer' },
  } } };
  assert.equal((await webhook(event)).status, 200);
  const secretRef = db.doc('jobSecrets/webhook-test');
  const originalCode = (await secretRef.get()).data().releaseCode;
  assert.match(originalCode, /^\d{6}$/);
  const retries = await Promise.all([webhook(event), webhook({ ...event, type: 'checkout.session.async_payment_succeeded' })]);
  assert.ok(retries.every(r => r.status === 200));
  assert.equal((await secretRef.get()).data().releaseCode, originalCode);
  const job = (await ref.get()).data();
  assert.equal(job.paymentStatus, 'paid');
  assert.equal(job.status, 'confirmed');
  assert.equal(job.amountPaid, 100);
});

test('failed delayed booking is recorded once and a late failure never downgrades a paid booking', async () => {
  const ref = db.doc('jobs/delayed-failure');
  await ref.set({ customerId: 'test-buyer', status: 'pending_payment', paymentStatus: 'unpaid', checkoutSessionId: 'cs_delayed_failure' });
  const event = { id: 'evt_failed', type: 'checkout.session.async_payment_failed', data: { object: {
    id: 'cs_delayed_failure', payment_status: 'unpaid', metadata: { flow: 'booking', jobId: ref.id, customerId: 'test-buyer' },
  } } };
  assert.equal((await webhook(event)).status, 200);
  const failed = (await ref.get()).data();
  assert.equal(failed.status, 'payment_failed');
  assert.equal(failed.paymentStatus, 'failed');
  assert.equal((await db.doc(`jobSecrets/${ref.id}`).get()).exists, false);
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await ref.get()).data().paymentFailedAt.toMillis(), failed.paymentFailedAt.toMillis());
  const success = { ...event, type: 'checkout.session.async_payment_succeeded', data: { object: { ...event.data.object, payment_status: 'paid', amount_total: 5000 } } };
  assert.equal((await webhook(success)).status, 200);
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await ref.get()).data().paymentStatus, 'paid');
  assert.equal((await ref.get()).data().status, 'confirmed');
});

test('failed quote stays payable, stale failures and other customers cannot overwrite it', async () => {
  const ref = db.doc('quotes/delayed-quote');
  await ref.set({ customerId: 'test-buyer', status: 'new', paymentStatus: 'pending', checkoutSessionId: 'cs_quote_current' });
  const session = { id: 'cs_quote_old', payment_status: 'unpaid', metadata: { flow: 'quote', quoteId: ref.id, customerId: 'test-buyer' } };
  const event = s => ({ id: 'evt_quote_failed', type: 'checkout.session.async_payment_failed', data: { object: s } });
  assert.equal((await webhook(event(session))).status, 200);
  assert.equal((await ref.get()).data().paymentStatus, 'pending');
  const current = { ...session, id: 'cs_quote_current' };
  assert.equal((await webhook(event({ ...current, metadata: { ...current.metadata, customerId: 'other-buyer' } }))).status, 200);
  assert.equal((await ref.get()).data().paymentStatus, 'pending');
  assert.equal((await webhook(event(current))).status, 200);
  assert.equal((await ref.get()).data().paymentStatus, 'failed');
  assert.equal((await ref.get()).data().status, 'new');
  assert.equal((await db.doc(`jobs/job_quote_${ref.id}`).get()).exists, false);
  assert.equal((await webhook({ id: 'evt_quote_paid', type: 'checkout.session.async_payment_succeeded', data: { object: { ...current, payment_status: 'paid', amount_total: 9000 } } })).status, 200);
  assert.equal((await webhook(event(current))).status, 200);
  assert.equal((await ref.get()).data().paymentStatus, 'paid');
  assert.equal((await ref.get()).data().status, 'processed');
});

test('platform handler ignores connected-account payments and the wrong mode', async () => {
  await db.doc('jobs/scoped').set({ customerId: 'test-buyer', status: 'pending_payment', paymentStatus: 'unpaid' });
  const event = { id: 'evt_scoped', type: 'checkout.session.completed', data: { object: {
    id: 'cs_scoped', payment_status: 'paid', metadata: { flow: 'booking', jobId: 'scoped', customerId: 'test-buyer' },
  } } };
  assert.equal((await webhook({ ...event, account: 'acct_other' })).status, 200);
  assert.equal((await webhook({ ...event, livemode: true })).status, 200);
  assert.equal((await db.doc('jobs/scoped').get()).data().paymentStatus, 'unpaid');
});

test('Connect synchronization uses stored account mapping and fresh Stripe state', async () => {
  const ref = db.doc('providers/connect-sync');
  await ref.set({ stripeAccountId: 'acct_providerSync', status: 'pending', stripeOnboardingComplete: false });
  await syncConnectedAccountStatus(db, 'acct_providerSync', async id => ({ id, charges_enabled: true, payouts_enabled: true }));
  assert.equal((await ref.get()).data().stripeOnboardingComplete, true);
  assert.equal((await ref.get()).data().status, 'pending'); // Stripe readiness never approves a provider.
  await syncConnectedAccountStatus(db, 'acct_providerSync', async id => ({ id, charges_enabled: true, payouts_enabled: false }));
  assert.equal((await ref.get()).data().stripeOnboardingComplete, false);
  let fetched = false;
  await syncConnectedAccountStatus(db, 'acct_unknown', async id => { fetched = true; return { id }; });
  assert.equal(fetched, false);
  await assert.rejects(syncConnectedAccountStatus(db, 'acct_providerSync', async () => { throw new Error('Stripe unavailable'); }));
  assert.equal((await ref.get()).data().stripeOnboardingComplete, false);
});

test('Connect synchronization rejects ambiguous or changed account mappings', async () => {
  await db.doc('providers/connect-duplicate').set({ stripeAccountId: 'acct_providerSync', stripeOnboardingComplete: false });
  await assert.rejects(syncConnectedAccountStatus(db, 'acct_providerSync', async id => ({ id, charges_enabled: true, payouts_enabled: true })));
  await db.doc('providers/connect-duplicate').delete();
  await assert.rejects(syncConnectedAccountStatus(db, 'acct_providerSync', async () => ({ id: 'acct_wrong', charges_enabled: true, payouts_enabled: true })));
  assert.equal((await db.doc('providers/connect-sync').get()).data().stripeOnboardingComplete, false);
});

test('Connect endpoint requires its own signature, connected-account scope, and the correct mode', async () => {
  const event = { id: 'evt_connect', type: 'account.updated', livemode: false, account: 'acct_unmapped', data: { object: { id: 'acct_unmapped' } } };
  const send = async (e, secret = 'whsec_connect_integration_test') => {
    const body = JSON.stringify(e);
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    return fetch(`${base}/api/webhooks/stripe/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body });
  };
  assert.equal((await send(event, 'whsec_integration_test')).status, 400);
  assert.equal((await send({ ...event, account: 'acct_wrong' })).status, 400);
  assert.equal((await send({ ...event, account: undefined })).status, 400);
  assert.equal((await send(event)).status, 200);
  assert.equal((await send({ ...event, livemode: true, account: 'acct_wrong' })).status, 200);
});
