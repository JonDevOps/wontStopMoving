import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, applyActionCode, reload } from 'firebase/auth';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { supportInquirySchema } from '../src/lib/support.ts';
import { sendSignupVerification } from '../src/lib/email-verification.ts';
import { syncConnectedAccountStatus } from '../src/lib/server/connect-status.ts';
import { TERMS_VERSION, TERMS_DOCUMENT_PATH, termsAcceptance } from '../src/lib/terms.ts';
import { customQuoteSchema, customQuoteTotal } from '../src/lib/custom-quotes.ts';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

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

const customDraft = () => ({ name: 'Custom Customer', email: 'test-customer@example.com', description: 'Two movers and a truck. Packing excluded.', pickupAddress: '123 Test Street', dropoffAddress: '456 Test Avenue', moveDate: '2026-12-15', expiresAt: new Date(Date.now() + 86400000).toISOString(), pricing: { type: 'fixed', total: 1250.75 } });
const authorized = (token, body) => ({ ...json(body), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });

test('custom pricing rejects ambiguous, malformed, fractional-cent and below-minimum estimates', () => {
  assert.equal(customQuoteTotal({ type: 'fixed', total: 1250.75 }), 1250.75);
  assert.equal(customQuoteTotal({ type: 'hourly', hourlyRate: 125, minimumHours: 2, estimatedHours: 3.5 }), 437.5);
  for (const pricing of [{ type: 'fixed', total: -5 }, { type: 'fixed', total: 5.001 }, { type: 'fixed', total: 5, hourlyRate: 1 }, { type: 'hourly', hourlyRate: 125, minimumHours: 3, estimatedHours: 2 }]) assert.equal(customQuoteSchema.safeParse({ ...customDraft(), pricing }).success, false);
});

test('only admins create custom quotes; verified intended recipient can claim and review, with pricing protected', async () => {
  assert.equal((await fetch(`${base}/api/admin/quotes`, json(customDraft()))).status, 401);
  assert.equal((await fetch(`${base}/api/admin/quotes`, authorized(customerToken, customDraft()))).status, 403);
  assert.equal((await fetch(`${base}/api/admin/quotes`, authorized(adminToken, { ...customDraft(), expiresAt: '2020-01-01T00:00:00.000Z' }))).status, 400);
  const created = await fetch(`${base}/api/admin/quotes`, authorized(adminToken, customDraft()));
  assert.equal(created.status, 201);
  const { id, url } = await created.json();
  assert.ok(url.endsWith(`/custom-quotes/${id}`));
  assert.equal((await db.doc(`quotes/${id}`).get()).data().customerId, '');
  const open = () => fetch(`${base}/api/custom-quotes/${id}`, authorized(customerToken, {}));
  assert.equal((await open()).status, 403); // Unverified account cannot claim private quotes.
  await getAdminAuth(adminApp).updateUser(auth.currentUser.uid, { emailVerified: true });
  await reload(auth.currentUser); customerToken = await auth.currentUser.getIdToken(true);
  assert.equal((await fetch(`${base}/api/custom-quotes/${id}`, authorized(adminToken, {}))).status, 403);
  const response = await open();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pricing.total, 1250.75);
  const q = (await db.doc(`quotes/${id}`).get()).data();
  assert.equal(q.customerId, auth.currentUser.uid);
  assert.equal(q.termsAcceptance, undefined); // Opening is not consent.
  assert.equal((await open()).status, 200);
  const checkout = body => fetch(`${base}/api/stripe/quote-checkout`, authorized(customerToken, { quoteId: id, termsAccepted: true, termsVersion: TERMS_VERSION, ...body }));
  assert.equal((await checkout({ total: 1 })).status, 503); // Valid quote reaches disabled test payment configuration; never Stripe.
  await db.doc(`quotes/${id}`).update({ pricing: { type: 'hourly', hourlyRate: 125, minimumHours: 2, estimatedHours: 3 } });
  const hourly = await checkout({}); assert.equal(hourly.status, 409); assert.match((await hourly.json()).error, /Hourly estimates/);
  await db.doc(`quotes/${id}`).update({ pricing: { type: 'fixed', total: 1250.75 }, expiresAt: Timestamp.fromMillis(0) });
  assert.equal((await checkout({})).status, 409);
  await db.doc(`quotes/${id}`).update({ expiresAt: Timestamp.fromMillis(Date.now() + 86400000), email: 'someone-else@example.com' });
  assert.equal((await open()).status, 404);
  // Restore the shared fixture for the subsequent verification-email test.
  await getAdminAuth(adminApp).updateUser(auth.currentUser.uid, { emailVerified: false });
  await reload(auth.currentUser); customerToken = await auth.currentUser.getIdToken(true);
});

test('checkout requires explicit current terms before any payment session or booking can be created', async () => {
  const beforeJobs = (await db.collection('jobs').get()).size;
  for (const route of ['/api/stripe/checkout', '/api/stripe/quote-checkout']) {
    assert.equal((await fetch(`${base}${route}`, json({ termsAccepted: true, termsVersion: TERMS_VERSION }))).status, 401);
    for (const terms of [{}, { termsAccepted: false, termsVersion: TERMS_VERSION }, { termsAccepted: 'true', termsVersion: TERMS_VERSION }, { termsAccepted: true }, { termsAccepted: true, termsVersion: 123 }]) {
      const response = await fetch(`${base}${route}`, { ...json(terms), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` } });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /Terms of Service/);
    }
    const stale = await fetch(`${base}${route}`, { ...json({ termsAccepted: true, termsVersion: 'outdated' }), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` } });
    assert.equal(stale.status, 409);
    // Test payment keys deliberately remain unconfigured: passing this gate
    // reaches the payment-config guard, without contacting Stripe or charging.
    const accepted = await fetch(`${base}${route}`, { ...json({ termsAccepted: true, termsVersion: TERMS_VERSION }), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` } });
    assert.equal(accepted.status, route.endsWith('quote-checkout') ? 400 : 503);
  }
  assert.equal((await db.collection('jobs').get()).size, beforeJobs);
});

test('the accepted terms revision has a permanent public page and unknown revisions return 404', async () => {
  const current = await fetch(`${base}/terms`);
  const versioned = await fetch(`${base}${TERMS_DOCUMENT_PATH}`);
  assert.equal(current.status, 200);
  assert.equal(versioned.status, 200);
  for (const html of [await current.text(), await versioned.text()]) {
    assert.match(html, /minimum number of hours is shown for your selected provider and booking/);
    assert.match(html, /November 8, 2026/);
    assert.doesNotMatch(html, /strict 3-hour minimum/);
  }
  assert.equal((await fetch(`${base}/terms/not-a-published-version`)).status, 404);
});

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
  const body = JSON.stringify({ livemode: false, ...event });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: valid ? 'whsec_integration_test' : 'whsec_wrong' });
  return fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body });
}

test('paid custom quote preserves its scope and price even when delivery arrives after expiry', async () => {
  const quoteId = 'custom-paid-fixture', customerId = 'custom-buyer', sessionId = 'cs_custom_paid';
  await db.doc(`quotes/${quoteId}`).set({ ...customDraft(), isCustomQuote: true, customerId, expiresAt: Timestamp.fromMillis(0), status: 'new', moveSize: 'custom' });
  await db.doc(`checkoutTerms/${sessionId}`).set({ quoteId, customerId, termsAcceptance: termsAcceptance(customerId, 'booking', Timestamp.now()) });
  const event = { id: 'evt_custom_paid', type: 'checkout.session.completed', data: { object: { id: sessionId, payment_status: 'paid', amount_total: 125075, payment_intent: 'pi_custom_paid', metadata: { flow: 'quote', quoteId, customerId, moveSize: 'custom', termsVersion: TERMS_VERSION } } } };
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await webhook(event)).status, 200);
  const job = (await db.doc(`jobs/job_quote_${quoteId}`).get()).data();
  assert.equal(job.price, 1250.75);
  assert.equal(job.serviceDescription, customDraft().description);
  assert.deepEqual(job.quotedPricing, customDraft().pricing);
  assert.equal(job.termsAcceptance.version, TERMS_VERSION);
});

test('paid quote fulfillment keeps the exact session agreement instead of a later attempt', async () => {
  const quoteId = 'terms-payment';
  const sessionId = 'cs_terms_original';
  const customerId = 'terms-buyer';
  const acceptedAt = Timestamp.fromMillis(Date.now() - 60000);
  const original = termsAcceptance(customerId, 'booking', acceptedAt);
  await db.doc(`quotes/${quoteId}`).set({ customerId, status: 'new', moveSize: 'studio', bookingTermsAcceptance: { ...original, version: 'later-attempt' } });
  const event = { id: 'evt_terms_paid', type: 'checkout.session.completed', data: { object: { id: sessionId, payment_status: 'paid', amount_total: 75000, metadata: { flow: 'quote', quoteId, customerId, termsVersion: TERMS_VERSION } } } };
  // A missing audit receipt is retryable; no successful payment is silently dropped.
  assert.equal((await webhook(event)).status, 500);
  await db.doc(`checkoutTerms/${sessionId}`).set({ customerId, quoteId, termsAcceptance: original });
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await webhook(event)).status, 200);
  const job = (await db.doc(`jobs/job_quote_${quoteId}`).get()).data();
  assert.equal(job.termsAcceptance.version, TERMS_VERSION);
  assert.equal(job.termsAcceptance.documentPath, TERMS_DOCUMENT_PATH);
  assert.equal(job.termsAcceptance.acceptedBy, customerId);
  assert.equal(job.termsAcceptance.acceptedAt.toMillis(), acceptedAt.toMillis());
});

test('legacy paid quote sessions are honored without inventing historical consent', async () => {
  const quoteId = 'legacy-terms';
  await db.doc(`quotes/${quoteId}`).set({ customerId: 'legacy-buyer', status: 'new', moveSize: 'studio', bookingTermsAcceptance: termsAcceptance('legacy-buyer', 'booking', Timestamp.now()) });
  const event = { id: 'evt_legacy_terms', type: 'checkout.session.completed', data: { object: { id: 'cs_legacy_terms', payment_status: 'paid', amount_total: 75000, metadata: { flow: 'quote', quoteId, customerId: 'legacy-buyer' } } } };
  assert.equal((await webhook(event)).status, 200);
  assert.equal('termsAcceptance' in (await db.doc(`jobs/job_quote_${quoteId}`).get()).data(), false);
});

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

test('a paid booking queues one admin alert, skips missing accounts, and retries never duplicate it', async () => {
  const outbox = await db.collection('emailOutbox').where('referenceId', '==', 'webhook-test').get();
  const messages = outbox.docs.map(doc => doc.data());
  assert.equal(messages.length, 1); // The test buyer has no Auth account, so only the admin alert exists.
  assert.equal(messages[0].to, 'admin-alerts@example.com');
  assert.equal(messages[0].category, 'job');
  assert.equal(messages[0].status, 'pending'); // Mail is not configured in tests, so nothing is sent.
});

test('admins can review failed emails: retry or dismiss unsent ones, never resend sent ones', async () => {
  const send = (token, body) => fetch(`${base}/api/admin/notifications`, authorized(token, body));
  const failed = db.doc('emailOutbox/test-failed-email');
  await failed.set({ to: 'someone@example.com', subject: 'Test', text: 'Test', category: 'job', referenceId: 'x', status: 'needs_review', failureCode: 'SMTP_DELIVERY_FAILED', createdAt: Timestamp.now() });
  assert.equal((await send(customerToken, { kind: 'retry', id: 'test-failed-email' })).status, 403);
  const list = await fetch(`${base}/api/admin/notifications`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).messages.some(m => m.id === 'test-failed-email' && m.status === 'needs_review' && m.failureCode === 'SMTP_DELIVERY_FAILED'));
  const dismissed = await send(adminToken, { kind: 'dismiss', id: 'test-failed-email' });
  assert.equal((await dismissed.json()).status, 'dismissed');
  assert.equal((await failed.get()).data().status, 'dismissed');
  const retried = await send(adminToken, { kind: 'retry', id: 'test-failed-email' });
  assert.equal((await retried.json()).status, 'pending_configuration'); // Back in the queue; mail is off in tests.
  const after = (await failed.get()).data();
  assert.equal(after.status, 'pending');
  assert.equal(after.failureCode, undefined);
  const sent = db.doc('emailOutbox/test-sent-email');
  await sent.set({ to: 'someone@example.com', subject: 'Test', text: 'Test', status: 'sent', createdAt: Timestamp.now() });
  assert.equal((await send(adminToken, { kind: 'retry', id: 'test-sent-email' })).status, 409);
  assert.equal((await sent.get()).data().status, 'sent');
});

test('the weekly draft job rejects calls without a valid Google-signed scheduler token', async () => {
  for (const headers of [{}, { Authorization: 'Bearer not-a-real-token' }, { Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6InNjaGVkdWxlckBleGFtcGxlLmlhbS5nc2VydmljZWFjY291bnQuY29tIn0.forged' }]) {
    assert.equal((await fetch(`${base}/api/cron/blog-drafts`, { method: 'POST', headers })).status, 401);
  }
  assert.equal((await db.collection('blogPosts').where('source', '==', 'ai').get()).size, 0);
});

test('blog posts appear only when scheduled and due, and only admins manage them', async () => {
  const slug = 'test-scheduled-moving-guide';
  const content = Array.from({ length: 4 }, (_, i) => `Paragraph ${i + 1}. ` + 'Plan your move carefully and label every box clearly. '.repeat(12)).join('\n\n');
  await db.doc(`blogPosts/${slug}`).set({ slug, title: 'Test Scheduled Moving Guide', excerpt: 'A test post for the scheduler that should only appear once it is due.', content, category: 'Home Moves', topicId: 'home-moves', image: 'blog-home', status: 'draft', source: 'admin', publishAt: null, createdAt: Timestamp.now() });
  const blog = (body, token = adminToken) => fetch(`${base}/api/admin/blog`, authorized(token, body));
  const page = () => fetch(`${base}/blog/${slug}`);
  assert.equal((await blog({ action: 'schedule', slug, publishAt: new Date().toISOString() }, customerToken)).status, 403);
  assert.equal((await page()).status, 404); // Drafts are never public.
  const future = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal((await (await blog({ action: 'schedule', slug, publishAt: future })).json()).status, 'scheduled');
  assert.equal((await page()).status, 404); // Not due yet.
  assert.equal((await (await blog({ action: 'schedule', slug, publishAt: new Date(Date.now() - 1000).toISOString() })).json()).status, 'published');
  const live = await page();
  assert.equal(live.status, 200);
  assert.ok((await live.text()).includes('Test Scheduled Moving Guide'));
  const listing = await fetch(`${base}/api/admin/blog`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.ok((await listing.json()).posts.some(p => p.slug === slug && p.status === 'scheduled'));
  assert.equal((await blog({ action: 'reject', slug })).status, 409); // Only drafts can be rejected.
  assert.equal((await (await blog({ action: 'unschedule', slug })).json()).status, 'draft');
  assert.equal((await page()).status, 404); // Unscheduling removes it at once.
  assert.equal((await blog({ action: 'save', slug, title: 'x', excerpt: 'short', content: 'too short', category: 'Home Moves' })).status, 400);
  assert.equal((await (await blog({ action: 'reject', slug })).json()).status, 'rejected');
  assert.equal((await blog({ action: 'schedule', slug, publishAt: new Date().toISOString() })).status, 409);
  assert.equal((await fetch(`${base}/blog/packing-fragile-items-movers-secret-guide`)).status, 200); // Existing posts still render.
});

test('admin approvals change status on the server and queue the approval email once', async () => {
  const approve = (token, body) => fetch(`${base}/api/admin/approvals`, authorized(token, body));
  const provider = await getAdminAuth(adminApp).createUser({ email: 'test-provider-approval@example.com', password: 'test-only-password' });
  await db.doc(`providers/${provider.uid}`).set({ uid: provider.uid, status: 'pending', businessName: 'Test Movers' });
  assert.equal((await approve(customerToken, { kind: 'provider', id: provider.uid, status: 'approved' })).status, 403);
  assert.equal((await approve(adminToken, { kind: 'provider', id: provider.uid, status: 'owner' })).status, 400);
  const first = await approve(adminToken, { kind: 'provider', id: provider.uid, status: 'approved' });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { status: 'approved', email: 'queued' }); // Mail is off in tests.
  assert.equal((await db.doc(`providers/${provider.uid}`).get()).data().status, 'approved');
  assert.equal((await (await approve(adminToken, { kind: 'provider', id: provider.uid, status: 'approved' })).json()).email, 'none'); // Already approved.
  const outbox = await db.collection('emailOutbox').where('referenceId', '==', provider.uid).get();
  assert.equal(outbox.size, 1);
  assert.equal(outbox.docs[0].data().to, 'test-provider-approval@example.com');
  assert.equal((await (await approve(adminToken, { kind: 'provider', id: provider.uid, status: 'suspended' })).json()).email, 'none');
  await db.doc('applications/test-app').set({ userId: provider.uid, status: 'new' });
  await db.doc(`employees/${provider.uid}`).set({ status: 'applicant' });
  const app = await (await approve(adminToken, { kind: 'application', id: 'test-app', status: 'active' })).json();
  assert.equal(app.status, 'active');
  assert.equal((await db.doc('applications/test-app').get()).data().status, 'approved');
  assert.equal((await db.doc(`employees/${provider.uid}`).get()).data().status, 'active');
  assert.equal((await approve(adminToken, { kind: 'employee', id: provider.uid, status: 'active', region: '<script>' })).status, 400);
});

test('ZIP lookup returns the city, state and service-area page, and rejects unknown ZIPs', async () => {
  const dallas = await fetch(`${base}/api/zip/75201`);
  assert.equal(dallas.status, 200);
  assert.deepEqual(await dallas.json(), { zip: '75201', city: 'Dallas', stateCode: 'TX', state: 'Texas', servedState: true, servedCity: true, href: '/locations/texas/dallas' });
  const stLouis = await (await fetch(`${base}/api/zip/63101`)).json();
  assert.equal(stLouis.city, 'Saint Louis');
  assert.equal(stLouis.href, '/locations/missouri/saint-louis');
  for (const zip of ['00000', 'abcde', '1234']) assert.equal((await fetch(`${base}/api/zip/${zip}`)).status, 404);
});

test('sales call log: staff only, server-priced, follow-ups queue and close', async () => {
  const calls = (token, body) => fetch(`${base}/api/sales/calls`, authorized(token, body));
  const call = { action: 'log', callType: 'quote-followup', service: 'residential', disposition: 'quote-sent', customerName: 'Pat Lead', customerPhone: '555-0100', moveSize: '2br', addOns: ['packing', 'not-a-real-addon'], estimatedTotal: 1 };
  assert.equal((await fetch(`${base}/api/sales/calls`, json(call))).status, 401);
  assert.equal((await calls(customerToken, call)).status, 403);
  assert.equal((await calls(adminToken, call)).status, 400); // This outcome needs a follow-up date.
  const followUpAt = new Date(Date.now() - 60000).toISOString();
  const created = await calls(adminToken, { ...call, followUpAt });
  assert.equal(created.status, 201);
  const { id, estimatedTotal } = await created.json();
  assert.equal(estimatedTotal, 1850); // 2-bedroom base 1500 + packing 350, never the browser's number.
  const saved = (await db.doc(`salesCalls/${id}`).get()).data();
  assert.deepEqual(saved.addOns, ['packing']);
  assert.equal(saved.followUpOpen, true);
  const queue = await (await fetch(`${base}/api/sales/calls`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(queue.followUps.some(f => f.id === id && f.customerName === 'Pat Lead'));
  assert.equal((await (await calls(adminToken, { action: 'done', id })).json()).done, true);
  const after = await (await fetch(`${base}/api/sales/calls`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(!after.followUps.some(f => f.id === id));
  const dnc = await (await calls(adminToken, { ...call, disposition: 'do-not-call', followUpAt })).json();
  assert.equal((await db.doc(`salesCalls/${dnc.id}`).get()).data().followUpOpen, false);
  assert.equal((await calls(adminToken, { ...call, callType: 'cold-call-anyone' })).status, 400);
});

test('creating a custom quote queues one email to the customer with the private link', async () => {
  const created = await fetch(`${base}/api/admin/quotes`, authorized(adminToken, customDraft()));
  assert.equal(created.status, 201);
  const { id, emailStatus } = await created.json();
  assert.equal(emailStatus, 'pending_configuration');
  const outbox = await db.collection('emailOutbox').where('referenceId', '==', id).get();
  assert.equal(outbox.size, 1);
  const message = outbox.docs[0].data();
  assert.equal(message.to, 'test-customer@example.com');
  assert.ok(message.text.includes(`/custom-quotes/${id}`));
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
