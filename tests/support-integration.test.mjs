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
import { dueFollowUpStep, followUpEmail } from '../src/lib/quote-followups.ts';
import { classifyChannel, cleanLeadSource } from '../src/lib/attribution.ts';
import { rankProviders } from '../src/lib/dispatch.ts';
import { waitStatus } from '../src/lib/service-requests.ts';
import { providerApplicationIncomplete } from '../src/lib/provider-application.ts';
import { compareToUs, scoreboard, cleanMetrics, parseCompetitorList, normalizeWebsite, sortActions } from '../src/lib/competitors.ts';
import { checkAgentApplication, networkCoverage, REGIONS, VETTING_CHECKS } from '../src/lib/agents.ts';
import { isPrivateAddress, htmlToText } from '../src/lib/server/safe-fetch.ts';

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

test('new quotes alert the team once; the lead inbox tracks contact, loss and reopening', async () => {
  const uid = auth.currentUser.uid;
  const lead = db.doc('quotes/test-lead-1');
  await lead.set({ customerId: uid, status: 'new', name: 'Lee Lead', email: 'test-customer@example.com', phone: '555-0101', moveSize: '2br', pickupZip: '75201', dropoffZip: '10001', moveDate: '2026-12-20', estimatedTotal: 1500, createdAt: Timestamp.now() });
  const notify = token => fetch(`${base}/api/leads/new`, authorized(token, { quoteId: 'test-lead-1' }));
  assert.equal((await notify(adminToken)).status, 403); // Not the admin's quote.
  assert.equal((await (await notify(customerToken)).json()).notified, true);
  await notify(customerToken); // A repeat never sends twice.
  const outbox = (await db.collection('emailOutbox').where('referenceId', '==', 'test-lead-1').get()).docs.map(d => d.data());
  assert.equal(outbox.length, 2);
  assert.ok(outbox.some(m => m.to === 'test-customer@example.com' && m.subject.includes('estimate')));
  assert.ok(outbox.some(m => m.to === 'admin-alerts@example.com' && m.subject.startsWith('New lead')));

  const inbox = async () => (await (await fetch(`${base}/api/admin/leads`, { headers: { Authorization: `Bearer ${adminToken}` } })).json());
  assert.equal((await fetch(`${base}/api/admin/leads`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  let found = (await inbox()).leads.find(l => l.id === 'test-lead-1');
  assert.equal(found.status, 'new');
  const leadAction = body => fetch(`${base}/api/admin/leads`, authorized(adminToken, body));
  assert.equal((await leadAction({ action: 'lost', id: 'test-lead-1', reason: 'Made up' })).status, 400);
  assert.equal((await leadAction({ action: 'contacted', id: 'test-lead-1' })).status, 200);
  found = (await inbox()).leads.find(l => l.id === 'test-lead-1');
  assert.equal(found.status, 'contacted');
  assert.equal(typeof found.responseMinutes, 'number');
  assert.ok(found.assignedTo);
  await leadAction({ action: 'lost', id: 'test-lead-1', reason: 'Price' });
  found = (await inbox()).leads.find(l => l.id === 'test-lead-1');
  assert.equal(found.status, 'lost');
  assert.equal(found.lostReason, 'Price');
  await leadAction({ action: 'reopen', id: 'test-lead-1' });
  assert.equal((await inbox()).leads.find(l => l.id === 'test-lead-1').status, 'contacted');

  // Logging a playbook call about a lead marks it contacted.
  await db.doc('quotes/test-lead-2').set({ customerId: uid, status: 'new', name: 'Second Lead', phone: '555-0102', moveSize: 'studio', estimatedTotal: 825, createdAt: Timestamp.now() });
  await fetch(`${base}/api/sales/calls`, authorized(adminToken, { action: 'log', callType: 'web-lead', service: 'residential', disposition: 'booked', customerName: 'Second Lead', customerPhone: '555-0102', leadId: 'test-lead-2' }));
  assert.equal((await inbox()).leads.find(l => l.id === 'test-lead-2').status, 'contacted');
});

test('quote follow-ups go out at 1, 3 and 7 days, never in a burst, and stop when they should', () => {
  const hour = 3600000, created = Date.UTC(2026, 0, 1);
  const base = { createdAtMs: created, sentStep: 0, hasEmail: true, booked: false, lost: false, stopped: false, suppressed: false };
  assert.equal(dueFollowUpStep(base, created + 23 * hour), null);
  assert.equal(dueFollowUpStep(base, created + 25 * hour), 1);
  assert.equal(dueFollowUpStep({ ...base, sentStep: 1 }, created + 30 * hour), null);
  assert.equal(dueFollowUpStep({ ...base, sentStep: 1 }, created + 73 * hour), 2);
  assert.equal(dueFollowUpStep(base, created + 100 * hour), 2); // Missed step 1: send only the latest due one.
  assert.equal(dueFollowUpStep({ ...base, sentStep: 2 }, created + 170 * hour), 3);
  assert.equal(dueFollowUpStep({ ...base, sentStep: 3 }, created + 180 * hour), null);
  assert.equal(dueFollowUpStep(base, created + 200 * hour), null); // Too old.
  for (const stop of ['booked', 'lost', 'stopped', 'suppressed']) assert.equal(dueFollowUpStep({ ...base, [stop]: true }, created + 25 * hour), null);
  assert.equal(dueFollowUpStep({ ...base, hasEmail: false }, created + 25 * hour), null);
  const links = { bookUrl: 'https://x/book', quoteUrl: 'https://x/quote', unsubscribeUrl: 'https://x/unsub', phone: '(415) 214-5474' };
  for (const step of [1, 2, 3]) {
    const { subject, text } = followUpEmail(step, { name: 'Sam', moveLabel: '2-Bedroom Home', route: '75201 → 10001', moveDate: '2026-12-20', total: 1850 }, links);
    assert.ok(subject.length > 5);
    assert.ok(text.includes('https://x/unsub') && text.includes('(415) 214-5474'));
    assert.ok(!/escrow/i.test(text));
  }
});

test('the hourly follow-up job rejects calls without a valid scheduler token', async () => {
  for (const headers of [{}, { Authorization: 'Bearer forged' }]) assert.equal((await fetch(`${base}/api/cron/quote-followups`, { method: 'POST', headers })).status, 401);
});

test('unsubscribe links stop follow-ups and add the address to the suppression list', async () => {
  const token = 'a'.repeat(36), q = db.doc('quotes/test-unsub');
  await q.set({ customerId: 'someone', status: 'new', email: 'Unsub-Test@Example.com', followUpToken: token, followUpStep: 1, createdAt: Timestamp.now() });
  const post = body => fetch(`${base}/api/unsubscribe`, json(body));
  assert.equal((await post({ quoteId: 'test-unsub', token: 'b'.repeat(36) })).status, 400);
  assert.equal((await post({ quoteId: 'test-unsub', token: 'short' })).status, 400);
  assert.equal((await q.get()).data().followUpsStopped, undefined);
  assert.equal((await post({ quoteId: 'test-unsub', token })).status, 200);
  assert.equal((await q.get()).data().followUpsStopped, true);
  const { createHash } = await import('node:crypto');
  assert.ok((await db.doc(`emailSuppressions/${createHash('sha256').update('unsub-test@example.com').digest('hex')}`).get()).exists);
  // One-click unsubscribe from mail apps: form POST to the List-Unsubscribe URL.
  await q.update({ followUpsStopped: false });
  const oneClick = await fetch(`${base}/api/unsubscribe?q=test-unsub&t=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.equal(oneClick.status, 200);
  assert.equal((await q.get()).data().followUpsStopped, true);
});

test('lead sources are classified into marketing channels and bounded', () => {
  assert.equal(classifyChannel(null), 'Direct');
  assert.equal(classifyChannel({ refCode: 'ABCD2345', utmMedium: 'cpc' }), 'Referral');
  assert.equal(classifyChannel({ utmSource: 'google', utmMedium: 'cpc' }), 'Paid search');
  assert.equal(classifyChannel({ utmSource: 'facebook', utmMedium: 'cpc' }), 'Paid social');
  assert.equal(classifyChannel({ utmMedium: 'email' }), 'Email');
  assert.equal(classifyChannel({ referrerHost: 'www.google.com' }), 'Organic search');
  assert.equal(classifyChannel({ referrerHost: 'l.facebook.com' }), 'Social');
  assert.equal(classifyChannel({ referrerHost: 'www.facebook.com' }), 'Social');
  assert.equal(classifyChannel({ referrerHost: 'blog.example.org' }), 'Other website');
  assert.equal(classifyChannel({ referrerHost: 'wontstopmoving.com', landingPath: '/quote' }), 'Direct');
  const cleaned = cleanLeadSource({ utmSource: 'x'.repeat(500), refCode: 'bad code!', extra: { nested: true } });
  assert.equal(cleaned.utmSource.length, 100);
  assert.equal(cleaned.refCode, undefined);
  assert.equal('extra' in cleaned, false);
  assert.equal(cleanLeadSource('nope'), null);
});

test('customers review completed moves once, and the provider rating updates', async () => {
  const uid = auth.currentUser.uid;
  await db.doc('providers/review-prov').set({ uid: 'review-prov', status: 'approved', rating: 4, reviewCount: 1 });
  await db.doc('jobs/review-job').set({ customerId: uid, providerIds: ['review-prov'], status: 'completed', paymentStatus: 'paid' });
  await db.doc('jobs/review-open').set({ customerId: uid, providerIds: ['review-prov'], status: 'confirmed', paymentStatus: 'paid' });
  const review = (token, body) => fetch(`${base}/api/reviews`, authorized(token, body));
  assert.equal((await review(customerToken, { jobId: 'review-job', rating: 7 })).status, 400);
  assert.equal((await review(customerToken, { jobId: 'review-open', rating: 5 })).status, 409);
  assert.equal((await review(adminToken, { jobId: 'review-job', rating: 5 })).status, 404); // Not the admin's move.
  const ok = await review(customerToken, { jobId: 'review-job', rating: 5, comment: 'Careful, fast and friendly crew.' });
  assert.equal(ok.status, 200);
  const provider = (await db.doc('providers/review-prov').get()).data();
  assert.equal(provider.reviewCount, 2);
  assert.equal(provider.rating, 4.5);
  assert.equal((await db.doc('providers/review-prov/reviews/review-job').get()).data().rating, 5);
  assert.equal((await review(customerToken, { jobId: 'review-job', rating: 5 })).status, 409); // Only once.
});

test('referral links: each customer gets a code, and a paid referred quote earns one reward', async () => {
  const me = token => fetch(`${base}/api/referrals/me`, { headers: { Authorization: `Bearer ${token}` } });
  const adminRef = await (await me(adminToken)).json();
  assert.match(adminRef.code, /^[A-Z2-9]{8}$/);
  assert.ok(adminRef.link.endsWith(`/quote?ref=${adminRef.code}`));
  assert.equal((await (await me(adminToken)).json()).code, adminRef.code); // Stable.
  const customerCode = (await (await me(customerToken)).json()).code;
  const customerUid = auth.currentUser.uid;
  const pay = async (quoteId, code) => {
    await db.doc(`quotes/${quoteId}`).set({ customerId: customerUid, status: 'new', moveSize: 'studio', name: 'Referred Friend', referralCode: code });
    const event = { id: `evt_${quoteId}`, type: 'checkout.session.completed', data: { object: { id: `cs_${quoteId}`, payment_status: 'paid', amount_total: 82500, metadata: { flow: 'quote', quoteId, customerId: customerUid } } } };
    assert.equal((await webhook(event)).status, 200);
    return event;
  };
  const event = await pay('referred-quote', adminRef.code);
  await webhook(event); // Retried webhook: still one reward.
  const reward = (await db.doc('referrals/job_quote_referred-quote').get()).data();
  assert.equal(reward.status, 'earned');
  assert.equal(reward.amountUsd, 25);
  assert.equal((await db.collection('referrals').where('quoteId', '==', 'referred-quote').get()).size, 1);
  await pay('self-referred-quote', customerCode); // Self-referrals don't count.
  assert.equal((await db.doc('referrals/job_quote_self-referred-quote').get()).exists, false);
  const list = await (await fetch(`${base}/api/admin/referrals`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(list.referrals.some(r => r.id === 'job_quote_referred-quote' && r.status === 'earned'));
  assert.equal((await fetch(`${base}/api/admin/referrals`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  await fetch(`${base}/api/admin/referrals`, authorized(adminToken, { id: 'job_quote_referred-quote' }));
  assert.equal((await db.doc('referrals/job_quote_referred-quote').get()).data().status, 'paid');
});

test('dispatch ranks approved, nearby, available providers first', () => {
  const job = { state: 'Texas', zip: '75201', moveDate: '2027-02-03' }; // A Wednesday.
  const ranked = rankProviders(job, [
    { id: 'far', name: 'Far Movers', status: 'approved', payoutsReady: true, state: 'Ohio', zipCode: '43004' },
    { id: 'near', name: 'Near Movers', status: 'approved', payoutsReady: true, state: 'Texas', zipCode: '75204', rating: 4.8, reviewCount: 10, completedJobs: 12 },
    { id: 'busy', name: 'Busy Movers', status: 'approved', payoutsReady: true, state: 'Texas', zipCode: '75201' },
    { id: 'off', name: 'Off Movers', status: 'approved', payoutsReady: true, state: 'Texas', zipCode: '75201', unavailableDates: ['2027-02-03'] },
    { id: 'pending', name: 'Pending Movers', status: 'pending', state: 'Texas', zipCode: '75201' },
  ], new Set(['busy']));
  assert.equal(ranked[0].id, 'near');
  assert.equal(ranked.at(-1).id, 'pending');
  assert.equal(ranked.find(c => c.id === 'pending').eligible, false);
  assert.ok(ranked.find(c => c.id === 'off').warnings.includes('Marked unavailable that day'));
  assert.ok(ranked.findIndex(c => c.id === 'busy') > ranked.findIndex(c => c.id === 'near'));
  assert.ok(ranked.find(c => c.id === 'near').reasons.includes('Nearby'));
});

test('dispatch, scorecards and insights: admin-only, assignment rules, and the numbers add up', async () => {
  const get = (path, token = adminToken) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  await db.doc('providers/ops-approved').set({ uid: 'ops-approved', status: 'approved', businessName: 'Ops Movers', state: 'Texas', zipCode: '75201', stripeOnboardingComplete: true, rating: 5, reviewCount: 2 });
  await db.doc('providers/ops-pending').set({ uid: 'ops-pending', status: 'pending', businessName: 'Pending Co', state: 'Texas', zipCode: '75201' });
  await db.doc('jobs/ops-job').set({ customerId: 'ops-customer', status: 'confirmed', paymentStatus: 'paid', amountPaid: 1000, moveDate: '2027-02-03', state: 'Texas', pickupAddress: '75201', providerIds: [], paidAt: Timestamp.now() });
  await db.doc('jobs/ops-done').set({ customerId: 'ops-customer', status: 'completed', paymentStatus: 'paid', amountPaid: 2000, payoutStatus: 'paid', moveDate: '2026-10-01', providerIds: ['ops-approved'], paidAt: Timestamp.now(), completedAt: Timestamp.now() });

  assert.equal((await get('/api/admin/dispatch?jobId=ops-job', customerToken)).status, 403);
  const suggestions = await (await get('/api/admin/dispatch?jobId=ops-job')).json();
  assert.equal(suggestions.candidates[0].id, 'ops-approved');
  const assign = providerId => fetch(`${base}/api/admin/dispatch`, authorized(adminToken, { jobId: 'ops-job', providerId }));
  assert.equal((await assign('ops-pending')).status, 409);
  assert.equal((await assign('ops-approved')).status, 200);
  assert.deepEqual((await db.doc('jobs/ops-job').get()).data().providerIds, ['ops-approved']);

  const cards = await (await get('/api/admin/scorecards')).json();
  const card = cards.scorecards.find(c => c.id === 'ops-approved');
  assert.equal(card.completed, 1);
  assert.equal(card.paidOut, 1700);
  assert.equal(card.assigned, 2);

  const month = new Date().toISOString().slice(0, 7);
  assert.equal((await fetch(`${base}/api/admin/insights`, authorized(adminToken, { month: '2026-13', channels: {} }))).status, 400);
  assert.equal((await fetch(`${base}/api/admin/insights`, authorized(adminToken, { month, channels: { 'Paid search': -5 } }))).status, 400);
  assert.equal((await fetch(`${base}/api/admin/insights`, authorized(adminToken, { month, channels: { 'Paid search': 300, 'Made up': 99 } }))).status, 200);
  assert.deepEqual((await db.doc(`marketingSpend/${month}`).get()).data().channels, { 'Paid search': 300 });
  assert.equal((await get('/api/admin/insights?days=30', customerToken)).status, 403);
  const insights = await (await get('/api/admin/insights?days=30')).json();
  assert.ok(insights.totals.gmv >= 3000);
  assert.equal(insights.totals.platformRevenue, Math.round(insights.totals.gmv * 0.15 * 100) / 100);
  assert.ok(insights.totals.marketingSpend >= 300);
  assert.ok(insights.channels.some(c => c.name === 'Paid search' && c.spend >= 300));
});

test('response-time targets flag waiting requests past their target', () => {
  const now = Date.UTC(2026, 0, 1, 12);
  assert.deepEqual(waitStatus(null, 4, now), { hours: 0, overdue: false, label: '' });
  assert.equal(waitStatus(now - 30 * 60000, 4, now).label, '30 min');
  assert.equal(waitStatus(now - 3 * 3600000, 4, now).overdue, false);
  assert.equal(waitStatus(now - 5 * 3600000, 4, now).overdue, true);
  assert.equal(waitStatus(now - 72 * 3600000, 24, now).label, '3 d');
});

test('service requests: customers request changes or claims on their own moves; resolving emails a satisfaction survey', async () => {
  const uid = auth.currentUser.uid;
  await db.doc('jobs/svc-upcoming').set({ customerId: uid, status: 'confirmed', paymentStatus: 'paid', moveDate: '2027-03-01' });
  await db.doc('jobs/svc-done').set({ customerId: uid, status: 'completed', paymentStatus: 'paid', moveDate: '2026-10-01' });
  const send = (token, body) => fetch(`${base}/api/service-requests`, authorized(token, body));
  assert.equal((await send(customerToken, { jobId: 'svc-upcoming', type: 'refund-now', reason: 'please' })).status, 400);
  assert.equal((await send(customerToken, { jobId: 'svc-upcoming', type: 'reschedule', reason: 'New lease starts later', requestedDate: '2020-01-01' })).status, 400);
  assert.equal((await send(adminToken, { jobId: 'svc-upcoming', type: 'cancel', reason: 'Not my move' })).status, 404);
  assert.equal((await send(customerToken, { jobId: 'svc-upcoming', type: 'claim', reason: 'Too early for a claim' })).status, 409);
  const created = await send(customerToken, { jobId: 'svc-upcoming', type: 'reschedule', reason: 'New lease starts later', requestedDate: '2027-03-08' });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await send(customerToken, { jobId: 'svc-upcoming', type: 'reschedule', reason: 'Asking again', requestedDate: '2027-03-09' })).status, 409);
  const claim = await send(customerToken, { jobId: 'svc-done', type: 'claim', reason: 'Table leg broken', item: 'Dining table', estimatedValue: 300, photoPaths: [`claims/${uid}/svc-done/a.jpg`, 'claims/someone-else/x/b.jpg'] });
  assert.equal(claim.status, 201);
  assert.deepEqual((await db.doc(`serviceRequests/${(await claim.json()).id}`).get()).data().photoPaths, [`claims/${uid}/svc-done/a.jpg`]);
  const mine = await (await fetch(`${base}/api/service-requests?jobId=svc-upcoming`, { headers: { Authorization: `Bearer ${customerToken}` } })).json();
  assert.ok(mine.requests.some(r => r.id === id && r.status === 'open' && r.requestedDate === '2027-03-08'));

  const desk = (body) => fetch(`${base}/api/admin/service-requests`, authorized(adminToken, body));
  assert.equal((await fetch(`${base}/api/admin/service-requests`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  assert.equal((await desk({ id, action: 'resolve', message: 'ok' })).status, 400); // Needs a real message.
  assert.equal((await desk({ id, action: 'resolve', message: 'Moved your booking to March 8 at the same price.' })).status, 200);
  const resolved = (await db.doc(`serviceRequests/${id}`).get()).data();
  assert.equal(resolved.status, 'resolved');
  assert.ok(resolved.firstResponseAt);
  const email = (await db.collection('emailOutbox').where('referenceId', '==', id).get()).docs.map(d => d.data()).find(m => m.subject.startsWith('Resolved'));
  assert.ok(email.text.includes('/feedback?k=request'));
  const feedback = body => fetch(`${base}/api/feedback`, json(body));
  assert.equal((await feedback({ kind: 'request', id, token: 'f'.repeat(36), score: 5 })).status, 400);
  assert.equal((await feedback({ kind: 'request', id, token: resolved.feedbackToken, score: 9 })).status, 400);
  assert.equal((await feedback({ kind: 'request', id, token: resolved.feedbackToken, score: 5 })).status, 200);
  const list = await (await fetch(`${base}/api/admin/service-requests`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(list.requests.find(r => r.id === id).satisfaction, 5);
  assert.equal(list.metrics.satisfactionPercent, 100);
});

test('resolving a support ticket records the first response and sends one satisfaction survey', async () => {
  const ticket = db.doc('supportTickets/csat-ticket');
  await ticket.set({ name: 'Riley Q', email: 'riley@example.com', phone: '', subject: 'Where is my code?', message: 'I cannot find my release code.', status: 'new', createdAt: Timestamp.now() });
  const patch = status => fetch(`${base}/api/admin/support/csat-ticket`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status }) });
  assert.equal((await patch('in-progress')).status, 200);
  assert.ok((await ticket.get()).data().firstResponseAt);
  await patch('resolved');
  await patch('in-progress');
  await patch('resolved');
  const surveys = (await db.collection('emailOutbox').where('referenceId', '==', 'csat-ticket').get()).docs;
  assert.equal(surveys.length, 1);
  assert.equal(surveys[0].data().to, 'riley@example.com');
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

test('providers who skipped the application (old Google shortcut) are sent back to finish it', () => {
  // What the old Google sign-in saved: no phone, no onboarding step.
  assert.equal(providerApplicationIncomplete({ status: 'pending', isEmployee: false, services: [], onboarding: {} }), true);
  // A real application.
  assert.equal(providerApplicationIncomplete({ status: 'pending', phone: '4155550100', onboardingStep: 2 }), false);
  // Approved providers, employees and admin-made records are never redirected.
  assert.equal(providerApplicationIncomplete({ status: 'approved' }), false);
  assert.equal(providerApplicationIncomplete({ status: 'pending', isEmployee: true }), false);
  assert.equal(providerApplicationIncomplete(null), true);
});

/** A separate signed-in browser session for an extra test user. */
async function extraUser(email, name) {
  const extra = initializeApp({ projectId, apiKey: 'fake-api-key', authDomain: `${projectId}.firebaseapp.com` }, `extra-${name}`);
  const extraAuth = getAuth(extra);
  connectAuthEmulator(extraAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const user = (await createUserWithEmailAndPassword(extraAuth, email, 'test-only-password')).user;
  return { user, app: extra, token: () => user.getIdToken(true) };
}

test('competitor scoreboard: we pass a competitor only by leading on every known number', () => {
  const us = { revenueUsd: 500000, googleReviews: 120, googleRating: 4.9 };
  assert.deepEqual(scoreboard(us, { revenueUsd: 400000, googleReviews: 100 }).passed, true);
  assert.equal(scoreboard(us, { revenueUsd: 400000, googleReviews: 300 }).passed, false);
  assert.equal(scoreboard(us, { revenueUsd: 400000 }).passed, false); // One known number is not enough.
  assert.equal(scoreboard(us, {}).known, 0);
  assert.equal(compareToUs(us, { googleRating: 4.9 }).googleRating, 'tied');
  assert.ok(scoreboard(us, { googleReviews: 240 }).gap > scoreboard(us, { googleReviews: 130 }).gap);
  assert.deepEqual(cleanMetrics({ revenueUsd: '$1,200', googleRating: 9, repeatRate: '30%', followers: -5, bogus: 3 }), { revenueUsd: 1200, googleRating: 5, repeatRate: 30 });
  const rows = parseCompetitorList('Name, Website\nBay Movers, baymovers.com, San Jose CA\nbay movers, dup.com\n\nAcme Moving\tacme.com\tOakland');
  assert.deepEqual(rows.map(r => [r.name, r.website, r.location]), [['Bay Movers', 'https://baymovers.com', 'San Jose CA'], ['Acme Moving', 'https://acme.com', 'Oakland']]);
  assert.equal(normalizeWebsite('javascript:alert(1)'), '');
  assert.equal(normalizeWebsite('https://user:pw@x.com'), '');
  assert.deepEqual(sortActions([{ impact: 'low', done: false }, { impact: 'high', done: true }, { impact: 'high', done: false }]).map(a => `${a.impact}${a.done}`), ['highfalse', 'lowfalse', 'hightrue']);
});

test('competitor website reader refuses private and metadata addresses and strips page markup', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
  const page = htmlToText('<html><head><title>Acme Movers</title><meta name="description" content="Bay Area movers"><style>p{}</style></head><body><script>steal()</script><p>Two movers &amp; truck: $129/hr</p></body></html>');
  assert.equal(page.title, 'Acme Movers');
  assert.equal(page.description, 'Bay Area movers');
  assert.equal(page.text, 'Two movers & truck: $129/hr');
});

const goodAgent = () => ({
  companyName: 'Test Van Lines', contactName: 'Pat Agent', phone: '(415) 555-0100', website: 'testvanlines.com', country: 'US', address: '1 Depot Way', city: 'Denver', region: 'US-CO', postalCode: '80202',
  usdot: '1234567', mcNumber: '765432', otherAuthority: '', yearsInBusiness: 12, trucks: 20, tractors: 4, warehouseSqft: 25000, employees: 60,
  services: ['Local moving', 'Storage / warehouse'], roles: ['origin', 'destination'], serviceRegions: ['US-CO', 'US-WY'], insuranceCarrier: 'Test Mutual', cargoCoverageUsd: 100000, about: '', agreementAccepted: true,
});

test('agent applications need authority, a truck, a service area and the agreement; coverage counts approved agents only', () => {
  assert.equal(REGIONS.filter(r => r.country === 'US').length, 51);
  assert.equal(REGIONS.filter(r => r.country === 'CA').length, 13);
  assert.equal(REGIONS.filter(r => r.country === 'MX').length, 32);
  assert.equal(checkAgentApplication(goodAgent()).ok, true);
  for (const [change, error] of [[{ usdot: '' }, /USDOT/], [{ trucks: 0 }, /truck/], [{ serviceRegions: ['XX-ZZ'] }, /states or provinces/], [{ agreementAccepted: 'true' }, /agreement/], [{ region: 'CA-ON' }, /state or province/], [{ roles: ['boss'] }, /how you want/]]) {
    const r = checkAgentApplication({ ...goodAgent(), ...change });
    assert.equal(r.ok, false); assert.match(r.error, error);
  }
  assert.equal(checkAgentApplication({ ...goodAgent(), country: 'CA', region: 'CA-ON', usdot: '', otherAuthority: 'NSC 123' }).ok, true);
  const cov = networkCoverage([{ status: 'approved', serviceRegions: ['US-CO'], trucks: 5, roles: ['origin'] }, { status: 'pending', serviceRegions: ['US-WY'], trucks: 9 }]);
  assert.equal(cov.covered, 1);
  assert.equal(cov.regions.find(r => r.code === 'US-CO').trucks, 5);
  assert.ok(cov.gaps.some(r => r.code === 'US-WY'));
});

test('admin invites: only admins invite; a verified sign-in with the invited email becomes admin once', async () => {
  const team = (token, body) => fetch(`${base}/api/admin/team`, authorized(token, body));
  assert.equal((await team(customerToken, { action: 'invite', email: 'invitee@example.com' })).status, 403);
  assert.equal((await team(adminToken, { action: 'invite', email: 'not-an-email' })).status, 400);
  const invited = await team(adminToken, { action: 'invite', email: 'Invitee@Example.com' });
  assert.equal((await invited.json()).status, 'invited');
  assert.equal((await db.doc('adminInvites/invitee@example.com').get()).data().status, 'pending');

  const invitee = await extraUser('invitee@example.com', 'invitee');
  const claim = async () => (await (await fetch(`${base}/api/auth/claim-admin`, authorized(await invitee.token(), {}))).json()).admin;
  assert.equal(await claim(), false); // Email not verified yet.
  assert.equal((await db.doc(`users/${invitee.user.uid}`).get()).exists, false);
  await getAdminAuth(adminApp).updateUser(invitee.user.uid, { emailVerified: true });
  await reload(invitee.user);
  assert.equal(await claim(), true);
  assert.equal((await db.doc(`users/${invitee.user.uid}`).get()).data().role, 'admin');
  assert.equal((await db.doc('adminInvites/invitee@example.com').get()).data().status, 'claimed');
  assert.equal(await claim(), false); // Single use.

  // Someone else verified with a different email gains nothing.
  assert.equal((await (await fetch(`${base}/api/auth/claim-admin`, authorized(customerToken, {}))).json()).admin, false);

  const list = await (await fetch(`${base}/api/admin/team`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(list.admins.some(a => a.uid === invitee.user.uid));
  assert.equal((await fetch(`${base}/api/admin/team`, authorized(await invitee.token(), { action: 'remove', uid: invitee.user.uid }))).status, 400); // Not yourself.
  assert.equal((await team(adminToken, { action: 'remove', uid: invitee.user.uid })).status, 200);
  assert.equal((await db.doc(`users/${invitee.user.uid}`).get()).data().role, 'customer');
  await deleteApp(invitee.app);
});

test('competitor tracker: admin-only list, import without duplicates, standings and actions', async () => {
  const send = (token, body) => fetch(`${base}/api/admin/competitors`, authorized(token, body));
  assert.equal((await send(customerToken, { action: 'add', name: 'Nope Movers' })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/competitors/abc/analyze`, authorized(customerToken, {}))).status, 403);
  await send(adminToken, { action: 'us', metrics: { revenueUsd: 500000, googleReviews: 150, customersPerYear: 900, repeatRate: 20 } });
  const added = await send(adminToken, { action: 'add', name: 'Slow Movers', website: 'slowmovers.com', metrics: { revenueUsd: 300000, googleReviews: 80 } });
  assert.equal(added.status, 201);
  const { id } = await added.json();
  const imported = await (await send(adminToken, { action: 'import', text: 'Slow Movers, slow.com\nFast Movers, fastmovers.com, Austin TX\nLegend Van Lines, legend.com', tier: 'challenger' })).json();
  assert.deepEqual(imported, { added: 2, skipped: 1 });
  const fast = (await db.collection('competitors').where('nameLower', '==', 'fast movers').get()).docs[0];
  await send(adminToken, { action: 'update', id: fast.id, metrics: { revenueUsd: 9000000, googleReviews: 2000 }, notes: { pricing: '$149/hr for 2 movers' } });
  assert.equal((await db.doc(`competitors/${fast.id}`).get()).data().notes.pricing, '$149/hr for 2 movers');

  const standings = await (await send(adminToken, { action: 'refresh-standings' })).json();
  assert.deepEqual(standings.newlyPassed, ['Slow Movers']);
  const list = await (await fetch(`${base}/api/admin/competitors`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  const byName = Object.fromEntries(list.competitors.map(c => [c.name, c]));
  assert.equal(byName['Slow Movers'].status, 'passed');
  assert.equal(byName['Fast Movers'].status, 'tracking');
  assert.equal(byName['Fast Movers'].score.behind, 2);
  assert.equal(list.us.metrics.revenueUsd, 500000); // Our entered number replaces the automatic one.

  await send(adminToken, { action: 'add-action', id: fast.id, text: 'Publish a flat 2-bedroom price', impact: 'high' });
  const actionId = (await db.doc(`competitors/${fast.id}`).get()).data().actions[0].id;
  await send(adminToken, { action: 'toggle-action', id: fast.id, actionId, done: true });
  assert.equal((await db.doc(`competitors/${fast.id}`).get()).data().actions[0].done, true);
  await send(adminToken, { action: 'pass', id: id, passed: false });
  assert.equal((await db.doc(`competitors/${id}`).get()).data().status, 'tracking');
  assert.equal((await send(adminToken, { action: 'delete', id: 'missing-id' })).status, 404);
});

test('agent network: apply, vet, approve, and accept a handoff; customer details only after accepting', async () => {
  const apply = (token, body) => fetch(`${base}/api/agents/apply`, authorized(token, body));
  assert.equal((await apply(customerToken, goodAgent())).status, 409); // Already a customer account.
  const agent = await extraUser('dispatch@testvanlines.example.com', 'agent');
  assert.equal((await apply(await agent.token(), { ...goodAgent(), trucks: 0 })).status, 400);
  assert.equal((await apply(await agent.token(), goodAgent())).status, 201);
  assert.equal((await db.doc(`users/${agent.user.uid}`).get()).data().role, 'agent');
  assert.equal((await db.doc(`agents/${agent.user.uid}`).get()).data().status, 'pending');

  const me = async () => (await fetch(`${base}/api/agents/me`, { headers: { Authorization: `Bearer ${await agent.token()}` } })).json();
  const pendingView = await me();
  assert.equal(pendingView.agent.status, 'pending');
  assert.equal(pendingView.agent.vetting, undefined); // Internal vetting notes stay private.
  assert.deepEqual(pendingView.directory, []);
  assert.equal((await fetch(`${base}/api/admin/agents`, { headers: { Authorization: `Bearer ${await agent.token()}` } })).status, 403);

  const admin = body => fetch(`${base}/api/admin/agents`, authorized(adminToken, body));
  assert.equal((await admin({ action: 'review', uid: agent.user.uid, status: 'approved' })).status, 409); // Vetting not finished.
  const jobRef = db.collection('jobs').doc('agent-handoff-job');
  await jobRef.set({ customerId: auth.currentUser.uid, moveDate: '2026-12-20', pickupAddress: 'Denver, CO', dropoffAddress: 'Austin, TX', status: 'confirmed', createdAt: Timestamp.now() });
  assert.equal((await admin({ action: 'assign', jobId: 'agent-handoff-job', role: 'origin', agentUid: agent.user.uid })).status, 409); // Not approved yet.
  for (const key of Object.keys(VETTING_CHECKS)) await admin({ action: 'vetting', uid: agent.user.uid, key, done: true });
  assert.equal((await admin({ action: 'review', uid: agent.user.uid, status: 'approved' })).status, 200);
  assert.equal((await admin({ action: 'assign', jobId: 'agent-handoff-job', role: 'origin', agentUid: agent.user.uid })).status, 200);
  const job = (await jobRef.get()).data();
  assert.deepEqual(job.agentIds, [agent.user.uid]);
  assert.equal(job.agentResponses[agent.user.uid], 'pending');

  let view = await me();
  assert.equal(view.shipments.length, 1);
  assert.equal(view.shipments[0].customer, null);
  assert.deepEqual(view.shipments[0].roles, ['origin']);
  const respond = (token, jobId) => fetch(`${base}/api/agents/me`, authorized(token, { action: 'respond', jobId, response: 'accepted' }));
  assert.equal((await respond(await agent.token(), 'some-other-job')).status, 404);
  assert.equal((await respond(customerToken, 'agent-handoff-job')).status, 403);
  assert.equal((await respond(await agent.token(), 'agent-handoff-job')).status, 200);
  view = await me();
  assert.equal(view.shipments[0].response, 'accepted');
  assert.ok(view.shipments[0].customer);

  const overview = await (await fetch(`${base}/api/admin/agents`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(overview.totals.approved, 1);
  assert.equal(overview.totals.trucks, 20);
  assert.ok(overview.coverage.find(r => r.code === 'US-CO').agents === 1);
  assert.equal((await admin({ action: 'assign', jobId: 'agent-handoff-job', role: 'origin', agentUid: null })).status, 200);
  assert.deepEqual((await jobRef.get()).data().agentIds, []);
  await deleteApp(agent.app);
});
