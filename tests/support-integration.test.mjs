import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, applyActionCode, reload } from 'firebase/auth';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { supportInquirySchema } from '../src/lib/support.ts';
import { sendSignupVerification } from '../src/lib/email-verification.ts';

const base = process.env.SUPPORT_TEST_BASE_URL;
if (!base?.startsWith('http://127.0.0.1:') || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('These tests require local emulators and the integration runner.');
}
const projectId = 'demo-wsm';
let adminApp, db, app, auth, adminToken, customerToken;
const inquiry = { name: 'Test Customer', email: 'contact-test@example.com', phone: '', subject: 'Test enquiry', message: 'Please help me plan my upcoming move.' };
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

before(async () => {
  adminApp = initializeAdmin({ projectId }, 'support-tests');
  db = getFirestore(adminApp);
  app = initializeApp({ projectId, apiKey: 'fake-api-key', authDomain: `${projectId}.firebaseapp.com` }, 'support-tests');
  auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const admin = (await createUserWithEmailAndPassword(auth, 'test-admin@example.com', 'test-only-password')).user;
  await db.doc(`users/${admin.uid}`).set({ role: 'admin' });
  adminToken = await admin.getIdToken();
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
  assert.equal((await fetch(`${base}/api/admin/support`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const listed = await fetch(`${base}/api/admin/support`, { headers });
  assert.equal(listed.status, 200);
  assert.match(listed.headers.get('cache-control'), /no-store/);
  assert.ok((await listed.json()).tickets.some(t => t.id === ticketId));
  for (const [token, status] of [[customerToken, 403], [adminToken, 200]]) {
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
  const body = JSON.stringify(event);
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
