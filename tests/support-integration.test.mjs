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
import { cleanMoveDetails, diffMoveDetails, formatMoveDate } from '../src/lib/move-details.ts';
import { cleanLocation, teamFromJob, isOnTeam, describeActivity } from '../src/lib/job-activity.ts';
import { toMover, siteFromEmail, saneUnits, filterMovers, sortMovers, ourRank, moversCsv, moverLikelihood, REGISTRY_AREAS, isProvince } from '../src/lib/registry.ts';
import { diffMovers, closureReason, mdy, zipOf, zipsWithin, expansionScore, acquisitionScore, isRecruitCandidate, moverVerdict, countyKey } from '../src/lib/market.ts';
import { priceCart, SALES_TAX_RATE } from '../src/lib/shop.ts';
import { platformOf, cleanSocials, passGaps } from '../src/lib/competitors.ts';
import { guessDomains, isDirectory, matchPage, nameTokens, urlsIn } from '../src/lib/web-presence.ts';
import { explainRank, sizeParts } from '../src/lib/registry.ts';
import { METROS } from '../src/lib/metros.ts';
import { usableCredit, giftCardAmount, normalizeGiftCode, formatGiftCode, isGiftCodeCore } from '../src/lib/rewards.ts';
import { diffPrices, describeChange } from '../src/lib/price-watch.ts';
import { categoryBits, categoriesOf, keepCarrier, toCarrierTuple, importDue, columnChanges, filterCarriers, sortCarriers, tupleToMover, servicesLabel, KNOWN_COLUMNS, partnerScore, isPartnerCandidate, newPartnerCarriers, newCarrierAlerts, primaryCategory, CATEGORY_COLOR } from '../src/lib/carriers.ts';
import { roadMilesBetween } from '../src/lib/distance.ts';
import { calculateMoveTotal, mileageFee, isLongDistance, MILEAGE } from '../src/lib/pricing.ts';
import { gzipSync } from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  // An existing account with an unverified email gets a pending invite, not instant admin.
  const unverified = await extraUser('squatter@example.com', 'squatter');
  await db.doc(`users/${unverified.user.uid}`).set({ role: 'customer' });
  assert.equal((await (await team(adminToken, { action: 'invite', email: 'squatter@example.com' })).json()).status, 'invited');
  assert.equal((await db.doc(`users/${unverified.user.uid}`).get()).data().role, 'customer');
  await team(adminToken, { action: 'cancel', email: 'squatter@example.com' });
  await deleteApp(unverified.app);

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
  const approvedAgents = overview.agents.filter(a => a.status === 'approved');
  assert.ok(approvedAgents.some(a => a.uid === agent.user.uid));
  assert.equal(overview.totals.approved, approvedAgents.length);
  assert.equal(overview.totals.trucks, approvedAgents.reduce((n, a) => n + (a.trucks || 0), 0));
  assert.ok(overview.coverage.find(r => r.code === 'US-CO').agents >= 1);
  assert.equal((await admin({ action: 'assign', jobId: 'agent-handoff-job', role: 'origin', agentUid: null })).status, 200);
  assert.deepEqual((await jobRef.get()).data().agentIds, []);
  await deleteApp(agent.app);
});

test('custom quotes sent to a verified email join that customer’s account automatically; others are untouched', async () => {
  const email = 'test-customer@example.com';
  const base_ = { isCustomQuote: true, email, name: 'Custom Customer', status: 'new', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000), pricing: { type: 'fixed', total: 10 } };
  await db.doc('quotes/auto-claim-mine').set({ ...base_, customerId: '' });
  await db.doc('quotes/auto-claim-taken').set({ ...base_, customerId: 'someone-else' });
  await db.doc('quotes/auto-claim-other-email').set({ ...base_, email: 'other@example.com', customerId: '' });
  const claim = async () => (await fetch(`${base}/api/custom-quotes/claim`, authorized(customerToken, {}))).json();
  await getAdminAuth(adminApp).updateUser(auth.currentUser.uid, { emailVerified: false });
  await reload(auth.currentUser); customerToken = await auth.currentUser.getIdToken(true);
  assert.deepEqual(await claim(), { claimed: 0, verified: false });
  assert.equal((await db.doc('quotes/auto-claim-mine').get()).data().customerId, '');
  await getAdminAuth(adminApp).updateUser(auth.currentUser.uid, { emailVerified: true });
  await reload(auth.currentUser); customerToken = await auth.currentUser.getIdToken(true);
  const result = await claim();
  assert.equal(result.verified, true);
  assert.ok(result.claimed >= 1);
  assert.equal((await db.doc('quotes/auto-claim-mine').get()).data().customerId, auth.currentUser.uid);
  assert.equal((await db.doc('quotes/auto-claim-taken').get()).data().customerId, 'someone-else');
  assert.equal((await db.doc('quotes/auto-claim-other-email').get()).data().customerId, '');
  assert.equal((await fetch(`${base}/api/custom-quotes/claim`, authorized(adminToken, {}))).status, 403);
  await getAdminAuth(adminApp).updateUser(auth.currentUser.uid, { emailVerified: false });
  await reload(auth.currentUser); customerToken = await auth.currentUser.getIdToken(true);
});

test('move details validation: dates, sizes and hours are checked; only real changes are logged', () => {
  assert.equal(cleanMoveDetails({ moveDate: '2026-02-30x' }).ok, false);
  assert.equal(cleanMoveDetails({ moveSize: 'mansion' }).ok, false);
  assert.equal(cleanMoveDetails({ hoursReserved: 100 }).ok, false);
  assert.equal(cleanMoveDetails({ pickupAddress: ' ' }).ok, false);
  const ok = cleanMoveDetails({ moveDate: '2026-12-20', hoursReserved: '3.3', moveTime: ' 8-10 AM ' });
  assert.deepEqual(ok, { ok: true, data: { moveDate: '2026-12-20', moveTime: '8-10 AM', hoursReserved: 3.5 } });
  const changes = diffMoveDetails({ moveDate: '2026-12-19', moveTime: '8-10 AM', moveSize: '2br' }, { moveDate: '2026-12-20', moveTime: '8-10 AM', moveSize: '3br' });
  assert.deepEqual(changes.map(c => [c.field, c.from, c.to]), [['moveDate', '2026-12-19', '2026-12-20'], ['moveSize', '2-bedroom', '3-bedroom']]);
  assert.equal(formatMoveDate('2026-12-20'), 'Sunday, December 20, 2026'); // No timezone drift.
});

test('staff edit move details: admins any move, crew only their own; locked once done; changes logged and customer emailed', async () => {
  const jobRef = db.doc('jobs/editable-move');
  await jobRef.set({ customerId: auth.currentUser.uid, status: 'confirmed', moveDate: '2026-12-19', pickupAddress: '1 Old St', dropoffAddress: '2 New Ave', moveSize: '2br', employeeIds: [], createdAt: Timestamp.now() });
  const crew = await extraUser('crew-member@example.com', 'crew');
  await db.doc(`users/${crew.user.uid}`).set({ role: 'employee', name: 'Casey Crew' });
  const save = async (token, body) => fetch(`${base}/api/jobs/editable-move/details`, authorized(await token, body));

  assert.equal((await save(customerToken, { details: { moveDate: '2026-12-21' } })).status, 403);
  assert.equal((await save(crew.token(), { details: { moveDate: '2026-12-21' } })).status, 403); // Not assigned yet.
  assert.equal((await save(adminToken, { details: { moveSize: 'castle' } })).status, 400);

  const before = (await db.collection('emailOutbox').get()).size;
  const r = await (await save(adminToken, { details: { moveDate: '2026-12-20', moveTime: '8-10 AM', moveSize: '2br' }, reason: 'Customer called', notifyCustomer: true })).json();
  assert.equal(r.changed, 2); // Size didn't change.
  assert.equal(r.emailed, true);
  const job = (await jobRef.get()).data();
  assert.equal(job.moveDate, '2026-12-20');
  assert.equal(job.moveTime, '8-10 AM');
  assert.equal((await db.collection('emailOutbox').get()).size, before + 1);

  await jobRef.update({ employeeIds: [crew.user.uid] });
  const crewSave = await (await save(crew.token(), { details: { accessNotes: 'Elevator booked 8-12' } })).json();
  assert.equal(crewSave.changed, 1);
  assert.equal(crewSave.emailed, false); // Access notes aren't customer-facing.
  const history = await (await fetch(`${base}/api/jobs/editable-move/details`, { headers: { Authorization: `Bearer ${await crew.token()}` } })).json();
  assert.equal(history.changes.length, 2);
  assert.equal(history.changes[0].by, 'Casey Crew');
  assert.equal(history.changes[1].reason, 'Customer called');

  await jobRef.update({ status: 'completed' });
  assert.equal((await save(adminToken, { details: { moveDate: '2026-12-22' } })).status, 409);
  await deleteApp(crew.app);
});

test('job team helpers: locations are range-checked and the team comes from the job', () => {
  assert.deepEqual(cleanLocation({ lat: 37.3861234, lng: -122.0838765, accuracy: 12.4 }), { lat: 37.38612, lng: -122.08388, accuracy: 12 });
  assert.equal(cleanLocation({ lat: 95, lng: 0 }), null);
  assert.equal(cleanLocation('here'), null);
  const job = { providerIds: ['p1'], employeeIds: ['e1'], agentAssignments: { origin: 'a1', destination: 'a2', bogus: 'x' } };
  assert.deepEqual(teamFromJob(job).map(m => `${m.kind}:${m.id}:${m.agentRole || ''}`), ['provider:p1:', 'employee:e1:', 'agent:a1:origin', 'agent:a2:destination']);
  assert.equal(isOnTeam(job, 'a2'), true);
  assert.equal(isOnTeam(job, 'x'), false);
  assert.equal(describeActivity({ type: 'assigned', assigneeKind: 'agent', agentRole: 'origin', assigneeName: 'Denver Van', by: 'Jon', byUid: 'u', byRole: 'admin', at: null }), 'Jon assigned Denver Van as Origin agent');
});

test('assignment history: admins assign movers, crew and agents; every change is logged; the team posts updates with location', async () => {
  const jobRef = db.doc('jobs/team-move');
  await jobRef.set({ customerId: auth.currentUser.uid, status: 'confirmed', moveDate: '2026-12-21', pickupAddress: 'A', dropoffAddress: 'B', providerIds: [], employeeIds: [], createdAt: Timestamp.now() });
  await db.doc('providers/pending-mover').set({ businessName: 'Pending Movers', status: 'pending' });
  const mover = await extraUser('mover@example.com', 'mover');
  await db.doc(`users/${mover.user.uid}`).set({ role: 'provider', name: 'Mo Mover' });
  await db.doc(`providers/${mover.user.uid}`).set({ businessName: 'Mo Moving Co', status: 'approved', city: 'San Jose', state: 'CA' });
  const crew = await extraUser('crew2@example.com', 'crew2');
  await db.doc(`users/${crew.user.uid}`).set({ role: 'employee', name: 'Cam Crew', state: 'CA' });
  const outsider = await extraUser('outsider-crew@example.com', 'outsider');
  await db.doc(`users/${outsider.user.uid}`).set({ role: 'employee', name: 'Not On It' });
  const url = `${base}/api/jobs/team-move/assignments`;
  const call = async (token, body) => fetch(url, authorized(await token, body));
  const get = async token => fetch(url, { headers: { Authorization: `Bearer ${await token}` } });

  assert.equal((await call(customerToken, { action: 'assign', kind: 'provider', assigneeId: mover.user.uid })).status, 403);
  assert.equal((await call(crew.token(), { action: 'assign', kind: 'provider', assigneeId: mover.user.uid })).status, 403);
  assert.equal((await call(adminToken, { action: 'assign', kind: 'provider', assigneeId: 'pending-mover' })).status, 409);
  assert.equal((await call(adminToken, { action: 'assign', kind: 'agent', assigneeId: mover.user.uid })).status, 400); // Agents need a role.
  assert.equal((await (await call(adminToken, { action: 'assign', kind: 'provider', assigneeId: mover.user.uid, note: 'Arrive 7:45, park on Elm' })).json()).changed, true);
  assert.equal((await (await call(adminToken, { action: 'assign', kind: 'provider', assigneeId: mover.user.uid })).json()).changed, false); // Already assigned: no duplicate entry.
  assert.equal((await call(adminToken, { action: 'assign', kind: 'employee', assigneeId: crew.user.uid })).status, 200);
  assert.deepEqual((await jobRef.get()).data().providerIds, [mover.user.uid]);

  assert.equal((await get(outsider.token())).status, 403);
  assert.equal((await call(mover.token(), { action: 'update', stage: 'note', note: '' })).status, 400);
  assert.equal((await call(mover.token(), { action: 'update', stage: 'at-pickup', note: 'Customer has 2 extra boxes', location: { lat: 37.33, lng: -121.89, accuracy: 8 } })).status, 201);
  assert.equal((await call(crew.token(), { action: 'update', stage: 'loaded', location: { lat: 999, lng: 0 } })).status, 201); // Bad location dropped, update kept.

  const view = await (await get(crew.token())).json();
  assert.equal(view.options, undefined); // Only admins see who else could be assigned.
  const moverRow = view.team.find(m => m.id === mover.user.uid);
  assert.equal(moverRow.name, 'Mo Moving Co');
  assert.equal(moverRow.base, 'San Jose, CA');
  assert.equal(moverRow.assignNote, 'Arrive 7:45, park on Elm');
  assert.ok(moverRow.assignedAt);
  assert.equal(moverRow.latest.stage, 'at-pickup');
  assert.deepEqual(moverRow.latest.location, { lat: 37.33, lng: -121.89, accuracy: 8 });
  const types = view.activity.map(a => `${a.type}:${a.stage || a.assigneeKind}`);
  assert.deepEqual(types, ['update:loaded', 'update:at-pickup', 'assigned:employee', 'assigned:provider']);
  assert.equal(view.activity[0].location, null);
  assert.equal(view.activity[3].by, 'test-admin@example.com'); // Falls back to the admin's email when no name is set.

  const adminView = await (await get(adminToken)).json();
  assert.ok(adminView.options.provider.some(o => o.id === mover.user.uid));
  assert.ok(!adminView.options.provider.some(o => o.id === 'pending-mover'));

  assert.equal((await call(adminToken, { action: 'unassign', kind: 'employee', assigneeId: crew.user.uid })).status, 200);
  assert.equal((await get(crew.token())).status, 403); // Off the team now.
  const after = await (await get(adminToken)).json();
  assert.equal(after.activity[0].type, 'unassigned');
  assert.equal(after.activity[0].assigneeName, 'Cam Crew');

  // The suggested-provider button logs history too.
  await jobRef.update({ providerIds: [] });
  assert.equal((await fetch(`${base}/api/admin/dispatch`, authorized(adminToken, { jobId: 'team-move', providerId: mover.user.uid }))).status, 200);
  const logged = (await db.collection('jobs/team-move/activity').where('note', '==', 'Suggested match').get()).size;
  assert.equal(logged, 1);
  for (const u of [mover, crew, outsider]) await deleteApp(u.app);
});

const census = (over = {}) => ({ dot_number: '1234567', legal_name: 'ACME MOVING & STORAGE LLC', dba_name: '', phy_street: '1 MAIN ST', phy_city: 'SAN JOSE', phy_state: 'CA', phy_zip: '95112', phy_cnty: '085', phone: '4085550100', email_address: 'office@acmemoving.com', company_officer_1: 'ANA ACME', business_org_desc: 'LIMITED LIABILITY COMPANY', power_units: '12', truck_units: '10', total_drivers: '14', total_cdl: '3', mcs150_mileage: '250000', mcs150_mileage_year: '2025', add_date: '20100105', mcs150_date: '20260101', carrier_operation: 'A', classdef: 'AUTHORIZED FOR HIRE', crgo_household: 'X', status_code: 'A', ...over });

test('registry: real movers are told apart from studios and freight; fleet typos are capped; areas, ranks and CSV work', () => {
  const ll = zip => ({ '95112': [37.35, -121.88], '98101': [47.61, -122.33], '94103': [37.77, -122.41] })[zip] || null;
  assert.equal(siteFromEmail('office@acmemoving.com'), 'https://acmemoving.com');
  assert.equal(siteFromEmail('acme@gmail.com'), '');
  assert.equal(saneUnits(50061, 3), 3);
  assert.equal(saneUnits(900, 683), 900);
  const acme = toMover(census(), { mc: 'MC123456', hhg: true, active: true, broker: false }, ll);
  assert.equal(acme.dot, '1234567'); assert.equal(acme.site, 'https://acmemoving.com'); assert.equal(acme.added, '2010-01-05');
  assert.equal(acme.likelyMover, true); assert.deepEqual([acme.lat, acme.lng], [37.35, -121.88]);
  const studio = toMover(census({ dot_number: '57426', legal_name: 'NBCUNIVERSAL MEDIA LLC', classdef: 'PRIVATE PROPERTY', crgo_genfreight: 'X', crgo_motoveh: 'X', crgo_bldgmat: 'X', crgo_machlrg: 'X', crgo_passengers: 'X', crgo_construct: 'X' }), undefined, ll);
  assert.equal(studio.likelyMover, false);
  const freight = toMover(census({ dot_number: '7', legal_name: 'METROSTAR EXPRESS LLC' }), undefined, ll);
  assert.equal(freight.likelyMover, false); // For-hire alone isn't enough without moving authority or a mover name.
  assert.ok(moverLikelihood({ name: 'BAY VAN LINES', dba: '', forHire: true, hhgAuth: false, cargoTypes: 1, broker: false }) >= 50);
  const sf = toMover(census({ dot_number: '22', legal_name: 'SF RELOCATION INC', phy_city: 'SAN FRANCISCO', phy_zip: '94103', phy_cnty: '075', power_units: '30', total_drivers: '40' }), { mc: '', hhg: true, active: true, broker: false }, ll);
  const sea = toMover(census({ dot_number: '33', legal_name: 'SEATTLE MOVERS', phy_city: 'SEATTLE', phy_state: 'WA', phy_zip: '98101', phy_cnty: '033', power_units: '50' }), undefined, ll);
  const rows = [acme, studio, freight, sf, sea];
  const bayArea = { states: ['CA'], counties: ['001', '013', '041', '055', '075', '081', '085', '095', '097'].map(c => `CA-${c}`) };
  const pugetSound = { states: ['WA'], counties: ['WA-033', 'WA-053', 'WA-061'] };
  assert.deepEqual(filterMovers(rows, { area: bayArea }).map(m => m.dot).sort(), ['1234567', '22']);
  assert.deepEqual(filterMovers(rows, { area: pugetSound }).map(m => m.dot), ['33']);
  assert.deepEqual(filterMovers(rows, { area: { states: ['CA'], counties: ['CA-075'] } }).map(m => m.dot), ['22']);
  assert.deepEqual(filterMovers(rows, { near: { lat: 37.77, lng: -122.41, miles: 10 } }).map(m => m.dot), ['22']);
  assert.deepEqual(filterMovers(rows, { bbox: { south: 37, west: -123, north: 38, east: -121 }, likelyOnly: false }).map(m => m.dot).sort(), ['1234567', '22', '57426', '7']);
  assert.deepEqual(sortMovers(filterMovers(rows, {}), 'units').map(m => m.dot), ['33', '22', '1234567']);
  const r = ourRank(filterMovers(rows, { area: bayArea }), { units: 15, drivers: 10, miles: 0, years: 2 }, 'units');
  assert.equal(r.rank, 2); assert.equal(r.of, 3); assert.equal(r.nextUp[0].dot, '22'); assert.equal(r.gapTo(sf).units, 16);
  assert.deepEqual(filterMovers(rows, { noSite: true }).map(m => m.dot).sort(), ['22', '33'].filter(d => !rows.find(m => m.dot === d).site));
  assert.deepEqual(filterMovers(rows, { hasSite: true }).map(m => m.dot), ['1234567', '22', '33'].filter(d => rows.find(m => m.dot === d).site && rows.find(m => m.dot === d).likelyMover));
  const fresh = toMover(census({ dot_number: '44', legal_name: 'BRAND NEW MOVING LLC', add_date: '20261001' }), undefined, ll);
  assert.deepEqual(filterMovers([acme, fresh], { addedSince: '2026-09-01' }).map(m => m.dot), ['44']);
  assert.deepEqual(filterMovers([acme, fresh], { maxYears: 2 }, Date.parse('2026-11-11T00:00:00Z')).map(m => m.dot), ['44']);
  assert.deepEqual(sortMovers([acme, fresh], 'newest').map(m => m.dot), ['44', '1234567']);
  const csv = moversCsv([acme]).split('\n');
  assert.match(csv[0], /^DOT,MC,Legal name/); assert.match(csv[1], /^1234567,MC123456,ACME MOVING & STORAGE LLC/);
});

test('metro areas: every U.S. metro of 250,000+ people, with counties across state lines', () => {
  assert.ok(METROS.length >= 190, `${METROS.length} metros`);
  assert.equal(new Set(METROS.map(m => m.key)).size, METROS.length);
  assert.equal(METROS[0].city, 'New York'); assert.deepEqual(METROS[0].states, ['NJ', 'NY']);
  for (const m of METROS) { assert.ok(m.pop >= 250_000 && m.counties.length && m.center, m.label); assert.ok(m.counties.every(c => /^[A-Z]{2}-\d{3}$/.test(c) && REGISTRY_AREAS.includes(c.slice(0, 2))), m.label); }
  const byCity = c => METROS.find(m => m.city === c && m.states.length);
  assert.ok(byCity('Portland').counties.includes('WA-011') && byCity('Portland').counties.includes('OR-051')); // Vancouver, WA is in the Portland metro.
  assert.ok(byCity('Seattle').counties.includes('WA-033'));
  for (const c of ['Boise', 'Anchorage', 'Spokane', 'Honolulu', 'Albuquerque', 'Omaha']) assert.ok(METROS.some(m => m.city.startsWith(c)), c);
  // Connecticut metros use the DOT's (old) county codes, not the Census planning regions.
  assert.deepEqual(byCity('New Haven').counties, ['CT-009']);
});

test('mover registry API: admin-only search, area ranking, tracking competitors by DOT; jobs need the scheduler', async () => {
  const ll = zip => ({ '95112': [37.35, -121.88], '94103': [37.77, -122.41] })[zip] || null;
  const movers = [
    toMover(census(), { mc: '', hhg: true, active: true, broker: false }, ll),
    toMover(census({ dot_number: '22', legal_name: 'SF RELOCATION INC', phy_city: 'SAN FRANCISCO', phy_zip: '94103', phy_cnty: '075', power_units: '30', total_drivers: '40', email_address: '' }), { mc: '', hhg: true, active: true, broker: false }, ll),
    toMover(census({ dot_number: '57426', legal_name: 'NBCUNIVERSAL MEDIA LLC', classdef: 'PRIVATE PROPERTY' }), undefined, ll),
  ];
  writeFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'CA.json.gz'), gzipSync(Buffer.from(JSON.stringify(movers))));
  writeFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'CA.lite.json.gz'), gzipSync(Buffer.from(JSON.stringify(movers.filter(m => m.likelyMover)))));
  await db.doc('registryStates/CA').set({ state: 'CA', count: 3, likely: 2, units: 42, drivers: 54, top: movers.filter(m => m.likelyMover).map(m => ({ ...m, size: 1 })), bbox: { south: 37, west: -123, north: 38.5, east: -121 }, center: [37.7, -122], updatedAt: Timestamp.now() });
  await db.doc('competitorSettings/us').set({ metrics: { trucks: 15, drivers: 10 } }, { merge: true });

  const search = async (token, qs) => fetch(`${base}/api/admin/registry?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await search(customerToken, 'region=bay-area')).status, 403);
  const res = await (await search(adminToken, 'region=bay-area&sort=units&rankBy=units&map=1&stats=1')).json();
  assert.equal(res.mode, 'detailed');
  assert.equal(res.total, 2); // The studio is filtered out as not a mover.
  assert.deepEqual(res.rows.map(r => r.dot), ['22', '1234567']);
  assert.equal(res.rank.rank, 2); // 15 trucks: behind SF Relocation (30), ahead of Acme (12).
  assert.equal(res.points.length, 2);
  assert.equal(res.jev, false);
  const all = await (await search(adminToken, 'region=bay-area&likely=0')).json();
  assert.equal(all.total, 3);
  const sanJose = await (await search(adminToken, 'region=msa-41940')).json(); // A metro: San Jose (Santa Clara County), not San Francisco.
  assert.deepEqual(sanJose.rows.map(r => r.dot), ['1234567']);
  const nationwide = await (await search(adminToken, 'sort=size')).json();
  assert.equal(nationwide.mode, 'national');
  assert.equal(nationwide.total, 2); // Every likely mover in the country (only CA in this fixture), not just top lists.
  assert.equal(nationwide.nationalComplete, true);
  const wholeMap = await (await search(adminToken, 'map=1&south=20&west=-130&north=50&east=-65')).json();
  assert.equal(wholeMap.points.length, 2); // Only CA exists in the fixture, so the map view loads it in detail.
  // Map pins follow the visible map even when the list is set to another area (here: list = Puget Sound, map over San Jose).
  const view = await (await search(adminToken, 'region=puget-sound&map=1&vbSouth=37.2&vbWest=-122.6&vbNorth=37.9&vbEast=-121.7')).json();
  assert.equal(view.total, 0);
  assert.equal(view.points.length, 2);
  const noSite = await (await search(adminToken, 'region=bay-area&site=0')).json();
  assert.deepEqual(noSite.rows.map(r => r.dot), ['22']);

  const csv = await search(adminToken, 'region=bay-area&format=csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.equal((await csv.text()).trim().split('\n').length, 3);

  const track = await (await fetch(`${base}/api/admin/registry`, authorized(adminToken, { action: 'track', query: { region: 'bay-area' }, limit: 5, tier: 'challenger' }))).json();
  assert.equal(track.added, 2);
  const again = await (await fetch(`${base}/api/admin/registry`, authorized(adminToken, { action: 'track', query: { region: 'bay-area' }, limit: 5 }))).json();
  assert.equal(again.added, 0); assert.equal(again.skipped, 2);
  const tracked = (await db.collection('competitors').where('dot', '==', '22').get()).docs[0].data();
  assert.equal(tracked.metrics.trucks, 30); assert.equal(tracked.location, 'San Francisco, CA'); assert.equal(tracked.tier, 'challenger');
  const trackedOnly = await (await search(adminToken, 'region=bay-area&tracked=1')).json();
  assert.equal(trackedOnly.total, 2); assert.ok(trackedOnly.rows.every(r => r.competitorId));

  const detail = await (await fetch(`${base}/api/admin/registry/1234567?state=CA`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(detail.mover.site, 'https://acmemoving.com');
  assert.match(detail.links.safer, /query_string=1234567/);
  assert.match(detail.sosSearchUrl, /bizfileonline\.sos\.ca\.gov/);
  assert.equal((await fetch(`${base}/api/admin/registry/1234567?state=CA`, authorized(adminToken, { action: 'classify' }))).status, 503); // Jev off in tests.
  const sos = await (await fetch(`${base}/api/admin/registry/1234567?state=CA`, authorized(adminToken, { action: 'sos' }))).json();
  assert.equal(sos.free, false); // California has no free registry data: link out instead.
  assert.equal((await fetch(`${base}/api/admin/registry/999?state=CA`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 404);
  // Website & socials: a recent lookup is served from cache (no web requests), even when asked to search again.
  assert.equal(detail.web, null); assert.equal(typeof detail.searchReady, 'boolean');
  await db.doc('registryEnrichment/1234567').set({ web: { site: 'https://acmemoving.com', source: 'email', matchedBy: ['phone'], socials: { facebook: 'https://facebook.com/acme' }, possibleSocials: {}, tried: [], searched: [], checkedAt: new Date() } }, { merge: true });
  const web = await (await fetch(`${base}/api/admin/registry/1234567?state=CA`, authorized(adminToken, { action: 'web', refresh: true }))).json();
  assert.equal(web.site, 'https://acmemoving.com'); assert.equal(web.socials.facebook, 'https://facebook.com/acme');
  assert.equal((await (await fetch(`${base}/api/admin/registry/1234567?state=CA`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).web.source, 'email');

  for (const path of ['/api/cron/registry-sync', '/api/cron/registry-enrich']) assert.equal((await fetch(`${base}${path}`, { method: 'POST' })).status, 401);
});

test('market logic: changes between days, closure reasons, expansion and buy scores, and the public verdict', () => {
  const ll = () => [37.35, -121.88];
  const a = toMover(census(), { mc: 'MC1', hhg: true, active: true, broker: false }, ll);
  const b = toMover(census({ dot_number: '22', legal_name: 'SF RELOCATION INC', power_units: '10' }), { mc: '', hhg: true, active: true, broker: false }, ll);
  const bBigger = { ...b, units: 14 };
  const c = toMover(census({ dot_number: '33', legal_name: 'NEW MOVERS LLC' }), undefined, ll);
  const changes = diffMovers([a, b], [bBigger, c]).map(x => `${x.type}:${x.mover.dot}${x.from !== undefined ? `:${x.from}->${x.to}` : ''}`).sort();
  assert.deepEqual(changes, ['closed:1234567', 'grew:22:10->14', 'new:33']);
  assert.deepEqual(diffMovers([b], [{ ...b, units: 11 }]), []); // Small changes are noise.

  assert.equal(mdy('02/10/2026'), '2026-02-10');
  assert.deepEqual(closureReason({ status: 'I', revocations: [{ type: 'INVOLUNTARY REVOCATION', date: '2026-05-11', license: 'COMMON' }], insuranceCancelled: [{ date: '2026-04-01', insurer: 'X', kind: 'BIPD' }] }), { reason: 'Operating authority involuntary revocation', date: '2026-05-11', confidence: 'confirmed' });
  assert.equal(closureReason({ revocations: [], insuranceCancelled: [{ date: '2026-03-31', insurer: 'LLOYDS', kind: 'CARGO' }] }).reason, 'Insurance cancelled (CARGO, LLOYDS)');
  assert.deepEqual(closureReason({ status: 'I', revocations: [], insuranceCancelled: [], lastFiling: '2026-05-08' }), { reason: 'USDOT number made inactive', date: '2026-05-08', confidence: 'likely' });

  assert.equal(zipOf('123 Main St, San Jose, CA 95112-1234'), '95112');
  assert.equal(countyKey('CA', '085'), '06085');
  const near = zipsWithin([37.35, -121.88], 10, { '95112': [37.35, -121.88], '95008': [37.28, -121.95], '94103': [37.77, -122.41] });
  assert.deepEqual(near, ['95112', '95008']);
  const underserved = expansionScore({ fips: '1', name: 'A', state: 'CA', population: 500000, movers: 5, trucks: 10, quotes: 0, bookings: 0 });
  const crowded = expansionScore({ fips: '2', name: 'B', state: 'CA', population: 500000, movers: 400, trucks: 900, quotes: 0, bookings: 0 });
  assert.ok(underserved > crowded);
  assert.ok(expansionScore({ fips: '2', name: 'B', state: 'CA', population: 500000, movers: 400, trucks: 900, quotes: 30, bookings: 3 }) > crowded);
  assert.equal(expansionScore({ fips: '3', name: 'C', state: 'CA', population: 5000, movers: 0, trucks: 0, quotes: 0, bookings: 0 }), 0);

  const now = Date.parse('2026-11-11T00:00:00Z');
  const old = { ...a, units: 6, added: '1995-01-01', updated: '2022-01-01', name: 'SMITH & SONS MOVING' };
  assert.ok(acquisitionScore(old, 31, now) >= 70);
  assert.equal(acquisitionScore({ ...old, units: 200 }, 31, now), 0); // Too big to be a small-owner buy.
  assert.equal(acquisitionScore(old, 5, now), 0);
  assert.equal(isRecruitCandidate({ ...a, units: 12 }, 16), true);
  assert.equal(isRecruitCandidate({ ...a, units: 12, hhgAuth: false }, 16), false);

  const good = moverVerdict({ status: 'A', interstate: true, hhgAuthority: true, commonActive: true, brokerActive: false, liabilityOnFile: 750000, cargoOnFile: 5000, revokedOn: null, years: 12, safety: 'S', state: 'CA', units: 10 });
  assert.equal(good.level, 'good');
  const broker = moverVerdict({ status: 'A', interstate: true, hhgAuthority: false, commonActive: false, brokerActive: true, liabilityOnFile: null, cargoOnFile: null, revokedOn: null, years: 4, safety: '', state: 'FL', units: 0 });
  assert.equal(broker.level, 'caution');
  assert.ok(broker.checks.some(c => /broker/i.test(c.text)));
  const revoked = moverVerdict({ status: 'A', interstate: true, hhgAuthority: true, commonActive: false, brokerActive: false, liabilityOnFile: null, cargoOnFile: null, revokedOn: '2026-05-11', years: 6, safety: '', state: 'CA', units: 2 });
  assert.equal(revoked.level, 'bad');
  const local = moverVerdict({ status: 'A', interstate: false, hhgAuthority: null, commonActive: null, brokerActive: false, liabilityOnFile: null, cargoOnFile: null, revokedOn: null, years: 8, safety: '', state: 'CA', units: 3 });
  assert.equal(local.level, 'good');
  assert.ok(local.notes.some(n => /CPUC/.test(n)));
});

test('market radar API: closures with a takeover plan, settings, recruiting and overflow from the registry; public checker validates input', async () => {
  const get = async (token, qs) => fetch(`${base}/api/admin/market?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const post = async (token, body) => fetch(`${base}/api/admin/market`, authorized(token, body));
  assert.equal((await get(customerToken, 'view=closures')).status, 403);
  await db.doc('registryEvents/closed-777').set({ type: 'closed', dot: '777', state: 'CA', county: '085', zip: '95112', lat: 37.35, lng: -121.88, name: 'OLD VALLEY MOVING INC', dba: '', city: 'SAN JOSE', phone: '4085550199', email: '', site: '', officer: 'PAT OWNER', mc: 'MC777', units: 4, drivers: 5, years: 22, hhgAuth: true, interstate: true, reason: 'Operating authority involuntary revocation', effectiveDate: '2026-10-01', confidence: 'confirmed', day: '2026-10-01' });
  await db.doc('registryEvents/closed-888').set({ type: 'closed', dot: '888', state: 'TX', county: '201', zip: '77002', lat: 29.75, lng: -95.36, name: 'HOUSTON MOVERS', dba: '', city: 'HOUSTON', phone: '', email: '', site: '', officer: '', mc: '', units: 2, drivers: 2, years: 5, hhgAuth: false, interstate: false, day: '2026-10-02' });
  const closures = await (await get(adminToken, 'view=closures')).json();
  assert.deepEqual(closures.events.map(e => e.dot), ['777']); // Watched areas default to the Bay Area and Puget Sound.
  assert.equal(closures.events[0].stage, 'new');
  const texas = await (await get(adminToken, 'view=closures&scope=TX')).json();
  assert.deepEqual(texas.events.map(e => e.dot), ['888']);

  const plan = await (await get(adminToken, 'view=takeover&dot=777')).json();
  assert.ok(plan.zips.includes('95112'));
  assert.equal(plan.takeover.stage, 'new');
  assert.equal(plan.links.landing, 'https://wontstopmoving.com/mover-closed');
  assert.equal((await post(adminToken, { action: 'takeover-update', dot: '777', stage: 'owner-contacted', assets: { phone: true }, notes: 'Owner open to selling the number.' })).status, 200);
  const after = await (await get(adminToken, 'view=takeover&dot=777')).json();
  assert.equal(after.takeover.stage, 'owner-contacted');
  assert.equal(after.takeover.assets.phone, true);
  assert.equal(after.takeover.log.length, 1);
  assert.equal((await post(adminToken, { action: 'takeover-update', dot: '777', stage: 'bogus' })).status, 400);
  assert.equal((await post(adminToken, { action: 'takeover-update', dot: '999', stage: 'done' })).status, 404);
  assert.equal((await post(adminToken, { action: 'takeover-scripts', dot: '777' })).status, 502); // No AI key in tests.

  assert.equal((await post(adminToken, { action: 'settings', states: ['TX'], autoAssign: false, maxMiles: 50 })).status, 200);
  const settings = await (await get(adminToken, 'view=settings')).json();
  assert.deepEqual(settings.settings.states, ['TX']);
  assert.equal(settings.routing.autoAssign, false);
  assert.equal(settings.routing.maxMiles, 50);
  const both = await (await get(adminToken, 'view=closures')).json();
  assert.deepEqual(both.events.map(e => e.dot).sort(), ['777', '888']);
  const houston = await (await get(adminToken, 'view=closures&scope=msa-26420')).json(); // One metro (Harris County is in Houston's).
  assert.deepEqual(houston.events.map(e => e.dot), ['888']);
  assert.equal((await post(adminToken, { action: 'settings', states: [], regions: ['msa-26420', 'msa-bogus'], autoAssign: true })).status, 200);
  const metroWatch = await (await get(adminToken, 'view=settings')).json();
  assert.deepEqual(metroWatch.settings.regions, ['msa-26420']);
  assert.ok(metroWatch.regions.length >= 190 && metroWatch.regions.find(r => r.key === 'msa-26420').label.startsWith('Houston'));
  assert.deepEqual((await (await get(adminToken, 'view=closures')).json()).events.map(e => e.dot), ['888']); // Watching Houston only.
  await post(adminToken, { action: 'settings', regions: ['bay-area', 'puget-sound'] });

  // Recruiting and overflow use the CA registry file written by the registry test.
  const recruits = await (await fetch(`${base}/api/admin/agents/recruits?state=CA`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(recruits.candidates.some(c => c.dot === '22')); // 30 trucks, 16 years, household-goods authority.
  assert.ok(!recruits.candidates.some(c => c.dot === '1234567')); // Already an agent (applied in the agent network test).
  const added = await (await fetch(`${base}/api/admin/agents`, authorized(adminToken, { action: 'prospect-add-many', movers: [{ dot: '22', state: 'CA' }] }))).json();
  assert.equal(added.added, 1);
  const prospect = (await db.collection('agentProspects').where('dot', '==', '22').get()).docs[0].data();
  assert.equal(prospect.region, 'US-CA'); assert.match(prospect.notes, /USDOT 22\b/);
  assert.equal((await (await fetch(`${base}/api/admin/agents`, authorized(adminToken, { action: 'prospect-add-many', movers: [{ dot: '22', state: 'CA' }] }))).json()).added, 0);
  const again = await (await fetch(`${base}/api/admin/agents/recruits?state=CA`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(!again.candidates.some(c => c.dot === '22'));

  await db.doc('jobs/overflow-job').set({ customerId: auth.currentUser.uid, status: 'confirmed', pickupAddress: '1 Main St, San Jose, CA 95112', dropoffAddress: 'Oakland', state: 'CA', createdAt: Timestamp.now() });
  await db.doc('providers/near-provider').set({ businessName: 'Near Movers', status: 'approved', zipCode: '95112' });
  const overflow = await (await fetch(`${base}/api/jobs/overflow-job/overflow`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(overflow.zip, '95112');
  assert.ok(overflow.network.some(n => n.id === 'near-provider' && n.miles === 0));
  assert.ok(overflow.registry.some(m => m.dot === '1234567'));
  assert.equal((await fetch(`${base}/api/jobs/overflow-job/overflow`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);

  assert.equal((await fetch(`${base}/api/public/check-mover?q=a`)).status, 400);
  assert.equal((await fetch(`${base}/api/public/check-mover/not-a-number`)).status, 400);
  assert.equal((await fetch(`${base}/check-a-mover`)).status, 200);
  assert.equal((await fetch(`${base}/mover-closed`)).status, 200);
});

test('registry covers Canadian provinces: postal codes are located by their first three characters', () => {
  assert.equal(REGISTRY_AREAS.length, 52 + 13);
  assert.equal(isProvince('ON'), true); assert.equal(isProvince('CA'), false); // CA is California, not Canada.
  const seen = [];
  const lookup = key => { seen.push(key); return key === 'M5V' ? [43.64, -79.39] : null; };
  const m = toMover(census({ dot_number: '555', legal_name: 'TORONTO MOVING INC', phy_state: 'ON', phy_zip: 'm5v3l9', phy_city: 'TORONTO' }), { mc: 'MC555', hhg: true, active: true, broker: false }, lookup);
  assert.equal(m.zip, 'M5V 3L9'); assert.deepEqual(seen, ['M5V']); assert.deepEqual([m.lat, m.lng], [43.64, -79.39]); assert.equal(m.state, 'ON');
  const us = toMover(census(), undefined, lookup);
  assert.equal(us.zip, '95112'); assert.equal(seen[1], '95112');
  const zips = JSON.parse(readFileSync(new URL('../src/data/zip-latlng.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(zips.M5V) && Array.isArray(zips['95112']));
});

test('mileage pricing: road miles from ZIP coordinates; first miles included, then per mile; long distance flagged', () => {
  const zips = { '94043': [37.41, -122.07], '95112': [37.35, -121.88], '95354': [37.64, -120.99], '92101': [32.72, -117.16] };
  const look = z => zips[z];
  const sj = roadMilesBetween('94043', '95112', look);
  assert.ok(sj >= 12 && sj <= 16, String(sj)); // Mountain View → San Jose ≈ 11 mi straight, ~14 road.
  assert.equal(roadMilesBetween('94043', '94043', look), 3);
  assert.equal(roadMilesBetween('94043', '00000', look), null);
  assert.equal(mileageFee(MILEAGE.includedMiles), 0);
  assert.equal(mileageFee(MILEAGE.includedMiles + 10), 10 * MILEAGE.perMile);
  const modesto = roadMilesBetween('94043', '95354', look);
  assert.equal(calculateMoveTotal('studio', [], { miles: modesto }), 825 + mileageFee(modesto));
  assert.equal(calculateMoveTotal('studio', [], {}), 825); // No ZIPs → flat price as before.
  assert.equal(isLongDistance(roadMilesBetween('94043', '92101', look)), true);
  assert.equal(isLongDistance(sj), false);
});

test('supplies shop: carts are priced on the server; unknown items and bad quantities dropped; delivery free over $150', () => {
  assert.equal(priceCart([], 'delivery'), null);
  assert.equal(priceCart([{ id: 'nope', qty: 2 }, { id: 'tape', qty: -1 }], 'pickup'), null);
  const small = priceCart([{ id: 'tape', qty: 2 }, { id: 'tape', qty: 1 }, { id: 'box-small', qty: 10 }], 'delivery');
  assert.deepEqual(small.lines.map(l => [l.id, l.qty, l.total]), [['tape', 3, 48], ['box-small', 10, 25]]);
  assert.equal(small.subtotal, 73); assert.equal(small.delivery, 15);
  assert.equal(small.tax, Math.round(73 * SALES_TAX_RATE * 100) / 100);
  assert.equal(small.total, Math.round((73 + 15 + small.tax) * 100) / 100);
  assert.equal(priceCart([{ id: 'kit-2br', qty: 1 }], 'delivery').delivery, 0);
  assert.equal(priceCart([{ id: 'tape', qty: 1 }], 'pickup').delivery, 0);
  assert.equal(priceCart([{ id: 'box-small', qty: 100000 }], 'pickup').lines[0].qty, 200);
});

test('shop checkout and confirmation: signed-in only, moves must be the customer’s, payment confirmed once with matching amount', async () => {
  const checkout = (token, body) => fetch(`${base}/api/shop/checkout`, authorized(token, body));
  assert.equal((await fetch(`${base}/api/shop/checkout`, json({ items: [{ id: 'tape', qty: 1 }], fulfillment: 'pickup' }))).status, 401);
  assert.equal((await checkout(customerToken, { items: [], fulfillment: 'pickup' })).status, 400);
  assert.equal((await checkout(customerToken, { items: [{ id: 'tape', qty: 1 }], fulfillment: 'teleport' })).status, 400);
  assert.equal((await checkout(customerToken, { items: [{ id: 'tape', qty: 1 }], fulfillment: 'with-move', jobId: 'someone-elses-job' })).status, 400);
  assert.equal((await checkout(customerToken, { items: [{ id: 'tape', qty: 1 }], fulfillment: 'pickup' })).status, 503); // Stripe off in tests.
  assert.equal((await db.collection('shopOrders').where('customerId', '==', auth.currentUser.uid).get()).size, 0); // Nothing saved before Stripe.

  const orderRef = db.collection('shopOrders').doc('shop-order-1');
  await orderRef.set({ customerId: auth.currentUser.uid, email: 'test-customer@example.com', status: 'pending', fulfillment: 'pickup', lines: [{ id: 'tape', name: 'Packing tape 6-pack', qty: 1, price: 16, total: 16 }], subtotal: 16, delivery: 0, tax: 1.46, total: 17.46, createdAt: Timestamp.now() });
  const paid = (amount, id) => ({ id, type: 'checkout.session.completed', data: { object: { id: `cs_${id}`, payment_status: 'paid', amount_total: amount, payment_intent: `pi_${id}`, metadata: { type: 'shop', orderId: 'shop-order-1', customerId: auth.currentUser.uid } } } });
  assert.equal((await webhook(paid(999, 'evt_shop_wrong'))).status, 200); // Wrong amount: acknowledged, not marked paid.
  assert.equal((await orderRef.get()).data().status, 'pending');
  assert.equal((await webhook(paid(1746, 'evt_shop_ok'))).status, 200);
  assert.equal((await orderRef.get()).data().status, 'paid');
  const before = (await db.collection('emailOutbox').get()).size;
  assert.equal((await webhook(paid(1746, 'evt_shop_again'))).status, 200);
  assert.equal((await db.collection('emailOutbox').get()).size, before); // Confirmed once.

  const mine = await (await fetch(`${base}/api/shop/orders`, { headers: { Authorization: `Bearer ${customerToken}` } })).json();
  assert.ok(mine.orders.some(o => o.id === 'shop-order-1' && o.status === 'paid'));
  assert.equal((await fetch(`${base}/api/admin/shop`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/shop`, authorized(adminToken, { id: 'shop-order-1', status: 'ready' }))).status, 200);
  assert.equal((await orderRef.get()).data().status, 'ready');
  assert.equal((await fetch(`${base}/shop`)).status, 200);
});

test('distance API and city moving reports (aggregates from the registry; small cities get no page)', async () => {
  const d = await (await fetch(`${base}/api/distance?from=94043&to=95112`)).json();
  assert.ok(d.miles > 5 && d.miles < 30); assert.equal(d.fee, 0);
  assert.equal((await fetch(`${base}/api/distance?from=abc&to=95112`)).status, 400);

  const ll = () => [45.52, -122.68];
  const portland = Array.from({ length: 7 }, (_, i) => toMover(census({ dot_number: String(900 + i), legal_name: `PORTLAND MOVING ${i} LLC`, phy_state: 'OR', phy_city: 'PORTLAND', phy_zip: '97201', power_units: String(2 + i), add_date: i === 0 ? '20260901' : '20100101' }), { mc: '', hhg: i % 2 === 0, active: true, broker: false }, ll));
  writeFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'OR.lite.json.gz'), gzipSync(Buffer.from(JSON.stringify(portland))));
  await db.doc('registryStates/OR').set({ state: 'OR', count: 7, likely: 7, units: 35, drivers: 70, top: [], updatedAt: Timestamp.now() });
  const page = await fetch(`${base}/moving-reports/or/portland`);
  assert.equal(page.status, 200);
  const html = (await page.text()).replace(/<!-- -->/g, '');
  assert.match(html, /Moving companies in Portland, OR/);
  assert.match(html, /7 moving companies registered/);
  assert.match(html, /57%<\/p><p[^>]*>licensed to move you to another state/); // Federal household-goods authority, not self-reported operation.
  assert.doesNotMatch(html, /PORTLAND MOVING 3/); // Aggregates only: no individual company named.
  assert.equal((await fetch(`${base}/moving-reports/or/salem`)).status, 404);
  const index = await (await fetch(`${base}/moving-reports`)).text();
  assert.match(index, /\/moving-reports\/or\/portland/);
});

test('feedback: anyone signed in can send; admins and employees review and reply (emailed); research is admin-only', async () => {
  const send = (token, body) => fetch(`${base}/api/app-feedback`, authorized(token, body));
  assert.equal((await fetch(`${base}/api/app-feedback`, json({ type: 'idea', message: 'Hello there' }))).status, 401);
  assert.equal((await send(customerToken, { type: 'idea', message: 'hi' })).status, 400);
  const created = await send(customerToken, { type: 'problem', message: 'The move date picker is hard to use on my phone.', page: '/dashboard/customer' });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const item = (await db.doc(`appFeedback/${id}`).get()).data();
  assert.equal(item.role, 'customer'); assert.equal(item.type, 'problem'); assert.equal(item.status, 'new');
  assert.equal((await fetch(`${base}/api/app-feedback`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 403);
  const crew = await extraUser('feedback-crew@example.com', 'feedback-crew');
  await db.doc(`users/${crew.user.uid}`).set({ role: 'employee', name: 'Fay Feedback', email: 'feedback-crew@example.com' });
  const list = await (await fetch(`${base}/api/app-feedback`, { headers: { Authorization: `Bearer ${await crew.token()}` } })).json();
  assert.ok(list.items.some(i => i.id === id));
  const before = (await db.collection('emailOutbox').get()).size;
  assert.equal((await send(await crew.token(), { action: 'update', id, status: 'planned', reply: 'Thanks! We are improving it this month.' })).status, 200);
  const after = (await db.doc(`appFeedback/${id}`).get()).data();
  assert.equal(after.status, 'planned'); assert.equal(after.repliedBy, 'Fay Feedback');
  assert.ok((await db.collection('emailOutbox').get()).size > before);
  assert.equal((await send(customerToken, { action: 'update', id, status: 'done' })).status, 403);
  await deleteApp(crew.app);

  const research = (token, body) => fetch(`${base}/api/admin/agents/research`, authorized(token, body));
  assert.equal((await research(customerToken, { dot: '22', state: 'CA' })).status, 403);
  assert.equal((await research(adminToken, {})).status, 400);
  assert.equal((await research(adminToken, { dot: '22', state: 'CA' })).status, 502); // No AI key in tests.
  assert.equal((await fetch(`${base}/api/admin/agents/research?key=bad%20key!`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 400);
  const none = await (await fetch(`${base}/api/admin/agents/research?key=22`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(none.result, null);
});

test('where to expand uses Census moving-business counts (and covers states the registry has not loaded)', async () => {
  const view = async scope => (await (await fetch(`${base}/api/admin/market?view=expansion&scope=${scope}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).counties;
  const santaClara = (await view('CA')).find(c => c.fips === '06085');
  assert.equal(santaClara.censusBusinesses, 58); // Census 2023 County Business Patterns, NAICS 484210.
  assert.ok(santaClara.movers >= 58);
  const hennepin = (await view('MN')).find(c => c.fips === '27053'); // Minnesota isn't in the test registry, but the Census counts it.
  assert.equal(hennepin?.censusBusinesses, 23);
  assert.equal(hennepin?.registryMovers, 0);
});

test('ranking is explained: score parts, what it takes to pass, per-measure ranks and next steps', () => {
  const ll = () => [37.35, -121.88];
  const rows = [
    toMover(census({ dot_number: '1', legal_name: 'BIG MOVING', power_units: '30', total_drivers: '40', mcs150_mileage: '0' }), { mc: '', hhg: true, active: true, broker: false }, ll),
    toMover(census({ dot_number: '2', legal_name: 'MID MOVING', power_units: '6', total_drivers: '8', mcs150_mileage: '0' }), undefined, ll),
    toMover(census({ dot_number: '3', legal_name: 'SMALL MOVING', power_units: '1', total_drivers: '1', mcs150_mileage: '0' }), undefined, ll),
  ];
  assert.deepEqual(sizeParts({ units: 6, drivers: 8, miles: 0 }), { trucks: 60, drivers: 32, miles: 0, total: 92 });
  const x = explainRank(rows, { units: 5, drivers: 5, miles: 0, years: 2, hasAuthority: false, hasWebsite: true });
  assert.equal(x.rank, 3); assert.equal(x.of, 4);
  assert.equal(x.ours.total, 70);
  assert.equal(x.nextUp[0].dot, '2');
  assert.deepEqual(x.nextUp[0].need, { points: 23, trucks: 3, drivers: 6 }); // 92 − 70 = 22 points to tie, 23 to pass.
  assert.equal(x.measures.find(m => m.label === 'Trucks').rank, 3);
  assert.ok(x.steps.some(st => /USDOT/.test(st)));
  assert.ok(explainRank(rows, { units: 0, drivers: 0, miles: 0, years: 0 }).steps[0].startsWith('Enter your trucks'));
});

test('social profiles: platforms detected from links, share links ignored; pass plan lists where they lead', () => {
  assert.equal(platformOf('https://www.facebook.com/acmemovers'), 'facebook');
  assert.equal(platformOf('instagram.com/acme'), 'instagram');
  assert.equal(platformOf('https://m.yelp.com/biz/acme'), 'yelp');
  assert.equal(platformOf('https://www.facebook.com/sharer/sharer.php?u=x'), null);
  assert.equal(platformOf('https://example.com'), null);
  assert.deepEqual(cleanSocials(['https://facebook.com/a', 'https://facebook.com/b', 'https://x.com/acme', 'junk']), { facebook: 'https://facebook.com/a', x: 'https://x.com/acme' });
  const gaps = passGaps({ googleReviews: 150, googleRating: 4.9, followers: 900 }, { googleReviews: 300, googleRating: 4.9, followers: 500 });
  assert.deepEqual(gaps.map(g => [g.key, g.tied]), [['googleReviews', false], ['googleRating', true]]);
});

test('our numbers merge (authority and socials survive saving metrics); competitor socials saved; registry returns the explanation', async () => {
  const post = body => fetch(`${base}/api/admin/competitors`, authorized(adminToken, body));
  await post({ action: 'us', hasAuthority: true, socials: ['https://instagram.com/wontstopmoving'] });
  await post({ action: 'us', metrics: { trucks: 15, drivers: 10, followers: 1200 } });
  const us = (await db.doc('competitorSettings/us').get()).data();
  assert.equal(us.hasAuthority, true); assert.deepEqual(us.socials, { instagram: 'https://instagram.com/wontstopmoving' }); assert.equal(us.metrics.followers, 1200);
  const id = (await (await post({ action: 'add', name: 'Social Movers', metrics: { followers: 5000 } })).json()).id;
  await post({ action: 'update', id, socials: ['https://facebook.com/socialmovers', 'https://www.yelp.com/biz/social-movers'] });
  assert.deepEqual((await db.doc(`competitors/${id}`).get()).data().socials, { facebook: 'https://facebook.com/socialmovers', yelp: 'https://www.yelp.com/biz/social-movers' });
  assert.equal((await post({ action: 'find-socials', id })).status, 400); // No website yet.
  const list = await (await fetch(`${base}/api/admin/competitors`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.equal(list.us.hasAuthority, true);
  assert.ok(list.competitors.find(c => c.id === id).socials.facebook);
  const reg = await (await fetch(`${base}/api/admin/registry?region=bay-area`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.match(reg.explain.formula, /trucks × 10/);
  assert.equal(reg.explain.ours.total, 15 * 10 + 10 * 4);
  assert.ok(!reg.explain.steps.some(st => /USDOT/.test(st))); // We said we have authority.
});

test('website finder: likely domains, directory sites skipped, a page only counts with phone, USDOT, or name plus city', () => {
  assert.deepEqual(guessDomains(['GENTLE GIANT MOVING COMPANY INC']), ['https://gentlegiantmoving.com', 'https://gentlegiant.com', 'https://gentlegiantmovers.com', 'https://gentlegiantmoving.com'].filter((v, i, a) => a.indexOf(v) === i));
  assert.deepEqual(guessDomains(['A B LLC']), []); // Too short to guess.
  assert.deepEqual(nameTokens('Two Guys Moving & Storage, LLC'), ['two', 'guys']);
  for (const u of ['https://www.yelp.com/biz/x', 'https://m.facebook.com/x', 'https://www.dmv.ca.gov', 'https://moving.com/x']) assert.ok(isDirectory(u), u);
  assert.ok(!isDirectory('https://acmemoving.com'));
  const m = { name: 'ACME MOVING LLC', city: 'SAN JOSE', phone: '4085551234', dot: '373544' };
  assert.deepEqual(matchPage(m, { text: 'Call us (408) 555-1234 today' }).matchedBy, ['phone']);
  assert.ok(matchPage(m, { text: 'Licensing: DOT #373544, MC 218' }).ok);
  assert.ok(!matchPage(m, { text: 'DOT #3735441' }).ok);
  assert.ok(matchPage(m, { text: 'Acme Moving serves San Jose and the South Bay' }).ok);
  assert.ok(!matchPage(m, { text: 'Acme Moving serves Boston' }).ok); // Same name, different company.
  assert.deepEqual(urlsIn('WEBSITE: https://acme.com.\nSOCIAL: https://facebook.com/acme)'), ['https://acme.com', 'https://facebook.com/acme']);
});

test('carrier categories: for-hire carriers sorted by what they haul; private fleets, buses and inactive left out', () => {
  const common = { status_code: 'A', classdef: 'AUTHORIZED FOR HIRE', dot_number: '00123', legal_name: 'DESERT FREIGHT LLC', phy_city: 'RENO', phy_zip: '89501-1234', phy_cnty: '031', power_units: '12', total_drivers: '14', add_date: '20150301', carrier_operation: 'A', email_address: 'Ops@DesertFreight.com' };
  const freight = { ...common, crgo_genfreight: 'X', crgo_motoveh: 'X' };
  assert.deepEqual(categoriesOf(categoryBits(freight)), ['freight', 'auto']);
  assert.deepEqual(categoriesOf(categoryBits({ crgo_cargoothr: 'X', hm_ind: 'Y' })), ['hazmat', 'other']);
  assert.equal(keepCarrier(freight), true);
  assert.equal(keepCarrier({ ...freight, classdef: 'PRIVATE PROPERTY' }), false);
  assert.equal(keepCarrier({ ...freight, status_code: 'I' }), false);
  assert.equal(keepCarrier({ ...common, crgo_passengers: 'X' }), false);
  const t = toCarrierTuple(freight, { mc: 'MC999', hhg: false, active: true, broker: false });
  assert.deepEqual(t.slice(0, 12), ['123', 'DESERT FREIGHT LLC', '', 'RENO', '89501', '031', '', 'ops@desertfreight.com', 12, 14, 0, '20150301']);
  const row = tupleToMover(t, 'NV', [39.5, -119.8]);
  assert.equal(row.site, 'https://desertfreight.com'); assert.equal(row.added, '2015-03-01'); assert.equal(row.authActive, true); assert.equal(row.mc, 'MC999');
  assert.equal(servicesLabel(row), 'General freight; Car carriers & towing');
  const small = toCarrierTuple({ ...freight, dot_number: '7', legal_name: 'TINY HAUL', power_units: '1', total_drivers: '1', phy_zip: '89101', phy_cnty: '003', email_address: 'x@gmail.com', carrier_operation: 'C' });
  const ll = z => ({ '89501': [39.5, -119.8], '89101': [36.2, -115.1] })[z] || null;
  assert.deepEqual(filterCarriers([t, small], { minUnits: 5 }, ll).map(m => m.t[0]), ['123']);
  assert.deepEqual(filterCarriers([t, small], { interstate: 'no' }, ll).map(m => m.t[0]), ['7']);
  assert.deepEqual(filterCarriers([t, small], { hasSite: true }, ll).map(m => m.t[0]), ['123']);
  assert.deepEqual(filterCarriers([t, small], { bbox: { south: 36, north: 37, west: -116, east: -114 } }, ll).map(m => m.t[0]), ['7']);
  assert.deepEqual(filterCarriers([t, small], { counties: ['003'] }, ll).map(m => m.t[0]), ['7']);
  assert.deepEqual(sortCarriers(filterCarriers([small, t], {}, ll), 'size').map(m => m.t[0]), ['123', '7']);
  assert.deepEqual(sortCarriers(filterCarriers([t, small], {}, ll), 'name').map(m => m.t[0]), ['123', '7']);
});

test('partner shortlist: scored on fleet, years, insured authority, interstate and website; new ones spotted between imports', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const base = { status_code: 'A', classdef: 'AUTHORIZED FOR HIRE', carrier_operation: 'A', phy_city: 'OAKLAND', phy_zip: '94607', phy_cnty: '001', phone: '5105551212', total_drivers: '10' };
  const strong = toCarrierTuple({ ...base, dot_number: '1', legal_name: 'BAY AUTO TRANSPORT', power_units: '20', add_date: '20100101', email_address: 'ops@bayauto.com', crgo_motoveh: 'X' }, { mc: 'MC1', hhg: false, active: true, broker: false });
  const weak = toCarrierTuple({ ...base, dot_number: '2', legal_name: 'NEW TRUCK LLC', power_units: '1', add_date: '20260901', email_address: 'newtruck@gmail.com', carrier_operation: 'C', crgo_genfreight: 'X' });
  const broker = toCarrierTuple({ ...base, dot_number: '3', legal_name: 'LOAD FINDERS', power_units: '1', add_date: '20200101', crgo_genfreight: 'X' }, { mc: 'MC3', hhg: false, active: false, broker: true });
  const mover = toCarrierTuple({ ...base, dot_number: '4', legal_name: 'BAY MOVERS', power_units: '8', crgo_household: 'X', crgo_genfreight: 'X' });
  const food = toCarrierTuple({ ...base, dot_number: '5', legal_name: 'COLD CHAIN', power_units: '8', crgo_coldfood: 'X' });
  const a = partnerScore(strong, now), b = partnerScore(weak, now), c = partnerScore(broker, now);
  assert.ok(a.score >= 85 && a.score <= 100, `strong ${a.score}`);
  assert.ok(b.score < 30, `weak ${b.score}`); assert.ok(c.score < b.score + 20);
  assert.ok(a.reasons.includes('active federal authority (insured)') && a.reasons.includes('ships vehicles') && a.reasons.includes('has a website'));
  assert.ok(c.reasons.some(r => r.startsWith('broker only')));
  assert.deepEqual([strong, weak, broker, mover, food].map(isPartnerCandidate), [true, true, true, false, false]); // Movers are in the mover list; food isn't a partner category.
  assert.equal(primaryCategory(strong[13]), 'auto'); assert.equal(CATEGORY_COLOR[primaryCategory(weak[13])], CATEGORY_COLOR.freight);
  const ll = () => [37.8, -122.27];
  assert.deepEqual(sortCarriers(filterCarriers([weak, broker, strong], {}, ll), 'score').map(m => m.t[0]), ['1', '2', '3']);
  assert.equal(tupleToMover(strong, 'CA', null).partnerScore, a.score);
  assert.equal(tupleToMover(food, 'CA', null).partnerScore, undefined);
  // New since the last import: nothing on the first one (no list to compare), then only unseen partner candidates.
  assert.deepEqual(newPartnerCarriers(null, [strong, weak]), []);
  assert.deepEqual(newPartnerCarriers(new Set(['1']), [strong, weak, mover, food]).map(t => t[0]), ['2']);
  const file = { generatedAt: new Date(now - 3 * 3600_000).toISOString(), baseline: false, rows: [['CA', ...weak], ['CA', ...strong], ['NV', ...broker]] };
  const watched = st => st === 'CA';
  assert.deepEqual(newCarrierAlerts(file, now, watched).map(x => x.t[0]), ['1', '2']); // Watched areas only, best first.
  assert.deepEqual(newCarrierAlerts({ ...file, generatedAt: new Date(now - 30 * 3600_000).toISOString() }, now, watched), []); // Reported once, the day of the import.
  assert.deepEqual(newCarrierAlerts({ ...file, baseline: true }, now, watched), []);
});

test('census import schedule: daily for the first three imports, then weekly; column changes flagged', () => {
  const now = Date.parse('2026-11-20T12:00:00Z'), ago = h => new Date(now - h * 3600_000).toISOString();
  assert.equal(importDue(null, now).due, true);
  assert.equal(importDue({ runs: 1, generatedAt: ago(5) }, now).due, false);
  assert.equal(importDue({ runs: 2, generatedAt: ago(23) }, now).due, true);
  assert.equal(importDue({ runs: 3, generatedAt: ago(30) }, now).due, false);
  assert.equal(importDue({ runs: 3, generatedAt: ago(24 * 7) }, now).due, true);
  assert.deepEqual(columnChanges(KNOWN_COLUMNS.map(c => c.toUpperCase())), { added: [], removed: [], missingRequired: [] });
  const changed = columnChanges([...KNOWN_COLUMNS.filter(c => c !== 'fax'), 'new_col']);
  assert.deepEqual([changed.added, changed.removed, changed.missingRequired], [['new_col'], ['fax'], []]);
  assert.deepEqual(columnChanges(['dot_number']).missingRequired.includes('legal_name'), true);
});

test('census file import: script splits the DOT file, the app loads movers from it and lists other carriers by category', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'census-'));
  const cols = KNOWN_COLUMNS;
  const line = o => cols.map(c => { const v = String(o[c] ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',');
  const nvBase = { status_code: 'A', classdef: 'AUTHORIZED FOR HIRE', phy_state: 'NV', phy_country: 'US', carrier_operation: 'A', add_date: '20100101', total_drivers: '5' };
  const rows = [
    { ...nvBase, dot_number: '9100001', legal_name: 'SILVER STATE MOVING LLC', phy_city: 'LAS VEGAS', phy_zip: '89101', phy_cnty: '003', power_units: '6', crgo_household: 'X' },
    { ...nvBase, dot_number: '9100002', legal_name: 'DESERT FREIGHT LLC', phy_city: 'RENO', phy_zip: '89501', phy_cnty: '031', power_units: '12', crgo_genfreight: 'X', crgo_motoveh: 'X', email_address: 'ops@desertfreight.com' },
    { ...nvBase, dot_number: '9100003', legal_name: 'ACME, "THE" HAULERS\nINC', phy_city: 'HENDERSON', phy_zip: '89002', phy_cnty: '003', power_units: '3', crgo_genfreight: 'X' },
    { ...nvBase, dot_number: '9100004', legal_name: 'CASINO SUPPLY CO', classdef: 'PRIVATE PROPERTY', phy_zip: '89101', crgo_genfreight: 'X' },
    { ...nvBase, dot_number: '9100005', legal_name: 'OLD FREIGHT', status_code: 'I', phy_zip: '89101', crgo_genfreight: 'X' },
    { ...nvBase, dot_number: '9100006', legal_name: 'STRIP SHUTTLE', phy_zip: '89101', crgo_passengers: 'X' },
  ];
  writeFileSync(join(dir, 'census.csv'), [cols.map(c => c.toUpperCase()).join(','), ...rows.map(line)].join('\r\n') + '\r\n');
  writeFileSync(join(dir, 'authority.csv'), 'DOCKET_NUMBER,DOT_NUMBER,COMMON_STAT,BROKER_STAT,HHG_CHK\nMC900001,09100001,A,N,Y\nMC900002,09100002,A,N,N\n');
  writeFileSync(join(dir, 'dict.pdf'), '%PDF-1.4 test dictionary');
  execFileSync(process.execPath, ['scripts/registry-import.mjs', 'run', '--census', join(dir, 'census.csv'), '--authority', join(dir, 'authority.csv'), '--dictionary', join(dir, 'dict.pdf'), '--out', process.env.REGISTRY_LOCAL_DIR], { env: { ...process.env, DICTIONARY_NAME: 'Dictionary Rev09.pdf' }, stdio: 'pipe' });
  const manifest = JSON.parse(readFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'import/manifest.json'), 'utf8'));
  assert.equal(manifest.counts.NV.movers, 1); assert.equal(manifest.counts.NV.carriers, 3);
  assert.deepEqual(manifest.counts.NV.categories, { household: 1, freight: 2, auto: 1 });
  assert.equal(manifest.runs, 1); assert.equal(manifest.dictionary.name, 'Dictionary Rev09.pdf');
  const check = execFileSync(process.execPath, ['scripts/registry-import.mjs', 'check', '--out', process.env.REGISTRY_LOCAL_DIR], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  assert.equal(JSON.parse(check).due, false);

  await db.doc('registryStates/NV').set({ backfilledAt: Timestamp.now() }); // Skip the closure-history backfill (network).
  const post = body => fetch(`${base}/api/admin/registry`, authorized(adminToken, body));
  const sync = await (await post({ action: 'sync', state: 'NV' })).json();
  assert.equal(sync.source, 'file'); assert.equal(sync.count, 1); assert.equal(sync.likely, 1);
  const nv = (await db.doc('registryStates/NV').get()).data();
  assert.equal(nv.importedAt, manifest.generatedAt); assert.equal(nv.carriers, 3); assert.equal(nv.categories.freight, 2);

  const get = qs => fetch(`${base}/api/admin/registry?${qs}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const movers = await (await get('states=NV&stats=1')).json();
  assert.equal(movers.rows[0].mc, 'MC900001'); assert.equal(movers.rows[0].hhgAuth, true);
  assert.equal(movers.import.runs, 1); assert.equal(movers.import.totals.carriers, manifest.totals.carriers);
  const freight = await (await get('states=NV&type=freight&map=1&stats=1')).json();
  assert.equal(freight.total, 2);
  assert.deepEqual(freight.rows.map(r => r.dot), ['9100002', '9100003']);
  assert.equal(freight.rows[1].name, 'ACME, "THE" HAULERS INC');
  assert.equal(freight.rank, null);
  assert.equal(freight.stateStats.find(s => s.state === 'NV').likely, 2);
  assert.ok(freight.points.length >= 1);
  assert.deepEqual((await (await get('states=NV&type=auto')).json()).rows.map(r => r.dot), ['9100002']);
  assert.equal((await (await get('states=NV&type=freight&minUnits=10')).json()).total, 1);
  const national = await (await get('type=freight')).json();
  assert.equal(national.needsArea, true); assert.equal(national.total, 0);
  const csv = await (await get('states=NV&type=freight&format=csv')).text();
  assert.match(csv, /General freight; Car carriers & towing/);
  const pdf = await fetch(`${base}/api/admin/registry/dictionary`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('content-disposition'), /Dictionary Rev09\.pdf/);
  assert.equal((await fetch(`${base}/api/admin/registry/dictionary`)).status, 401);

  // The partner shortlist: freight and car carriers (not movers), scored, with pins colored by category.
  const partners = await (await get('states=NV&type=partners&map=1&stats=1')).json();
  assert.deepEqual(partners.rows.map(r => r.dot), ['9100002', '9100003']);
  assert.ok(partners.rows[0].partnerScore > partners.rows[1].partnerScore);
  assert.ok(partners.rows[0].partnerReasons.includes('ships vehicles'));
  assert.equal(partners.points.find(p => p[0] === '9100002')[6], CATEGORY_COLOR.auto);
  assert.equal(partners.stateStats.find(s => s.state === 'NV').likely, 2);
  assert.equal(partners.import.totals.partners, manifest.totals.partners);
  assert.match(await (await get('states=NV&type=partners&format=csv')).text(), /Partner fit \(0-100\),Why/);
  const recruit = await (await post({ action: 'recruit', dots: [{ dot: '9100002', state: 'NV' }, { dot: '9100001', state: 'NV' }] })).json();
  assert.deepEqual([recruit.added, recruit.skipped], [1, 1]); // The mover isn't on the shortlist.
  const prospect = (await db.collection('agentProspects').where('dot', '==', '9100002').get()).docs[0].data();
  assert.equal(prospect.source, 'partner-shortlist'); assert.match(prospect.notes, /Car carriers & towing/);
  assert.equal((await (await post({ action: 'recruit', dots: [{ dot: '9100002', state: 'NV' }] })).json()).added, 0);

  // Next import: a new car carrier shows up in the new-carriers list (the first import had nothing to compare with).
  const { gunzipSync } = await import('node:zlib');
  const newList = () => JSON.parse(gunzipSync(readFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'import/new-carriers.json.gz'))).toString('utf8'));
  assert.equal(newList().baseline, true);
  rows.push({ ...nvBase, dot_number: '9100007', legal_name: 'VEGAS CAR SHIPPERS', phy_city: 'LAS VEGAS', phy_zip: '89101', phy_cnty: '003', power_units: '4', crgo_motoveh: 'X' });
  writeFileSync(join(dir, 'census.csv'), [cols.map(c => c.toUpperCase()).join(','), ...rows.map(line)].join('\r\n') + '\r\n');
  execFileSync(process.execPath, ['scripts/registry-import.mjs', 'run', '--census', join(dir, 'census.csv'), '--authority', join(dir, 'authority.csv'), '--out', process.env.REGISTRY_LOCAL_DIR], { stdio: 'pipe' });
  const second = newList();
  assert.equal(second.baseline, false); assert.deepEqual(second.rows.map(r => r.slice(0, 2)), [['NV', '9100007']]);
  assert.equal(JSON.parse(readFileSync(join(process.env.REGISTRY_LOCAL_DIR, 'import/manifest.json'), 'utf8')).totals.newPartners, 1);
});

test('rewards: credit covers at most 15% of a move; gift card codes are normalized', () => {
  assert.equal(usableCredit(1000, 500), 150);
  assert.equal(usableCredit(1000, 40), 40);
  assert.equal(usableCredit(0, 40), 0);
  assert.equal(usableCredit(825, -5), 0);
  assert.equal(giftCardAmount(100), 100);
  assert.equal(giftCardAmount(24), null);
  assert.equal(giftCardAmount(10.5), null);
  assert.equal(giftCardAmount(1001), null);
  assert.equal(normalizeGiftCode('wsm-abcd-efgh'), 'ABCDEFGH');
  assert.equal(formatGiftCode('ABCDEFGH'), 'WSM-ABCD-EFGH');
  assert.equal(isGiftCodeCore('ABCDEFGH'), true);
  assert.equal(isGiftCodeCore('ABCDEFG0'), false); // No zeros in codes.
});

test('gift cards: issued once on a matching payment, redeemed once into move credit; expired checkouts only return credit they held', async () => {
  const uid = auth.currentUser.uid;
  assert.equal((await fetch(`${base}/api/gift-cards/checkout`, json({ amount: 50, recipientEmail: 'friend@example.com' }))).status, 401);
  assert.equal((await fetch(`${base}/api/gift-cards/checkout`, authorized(customerToken, { amount: 5, recipientEmail: 'friend@example.com' }))).status, 400);
  assert.equal((await fetch(`${base}/api/gift-cards/checkout`, authorized(customerToken, { amount: 50, recipientEmail: 'not-an-email' }))).status, 400);

  const orderRef = db.doc('giftCardOrders/gc-order-1');
  await orderRef.set({ buyerUid: uid, buyerEmail: 'test-customer@example.com', amount: 50, recipientEmail: 'friend@example.com', recipientName: 'Sam', fromName: 'Alex', message: '', status: 'pending', createdAt: Timestamp.now() });
  const paid = (amount, id) => ({ id, type: 'checkout.session.completed', data: { object: { id: `cs_${id}`, payment_status: 'paid', amount_total: amount, metadata: { type: 'giftcard', orderId: 'gc-order-1', customerId: uid } } } });
  assert.equal((await webhook(paid(4000, 'evt_gc_wrong'))).status, 200);
  assert.equal((await orderRef.get()).data().status, 'pending');
  assert.equal((await webhook(paid(5000, 'evt_gc_ok'))).status, 200);
  assert.equal((await webhook(paid(5000, 'evt_gc_again'))).status, 200);
  const order = (await orderRef.get()).data();
  assert.equal(order.status, 'paid');
  assert.equal((await db.collection('giftCards').where('orderId', '==', 'gc-order-1').get()).size, 1);

  const redeem = code => fetch(`${base}/api/rewards/redeem`, authorized(customerToken, { code }));
  assert.equal((await redeem('WSM-2222-2222')).status, 404);
  const ok = await redeem(formatGiftCode(order.code).toLowerCase());
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).amount, 50);
  assert.equal((await redeem(formatGiftCode(order.code))).status, 409);
  const me = await (await fetch(`${base}/api/rewards/me`, { headers: { Authorization: `Bearer ${customerToken}` } })).json();
  assert.equal(me.balance, 50);
  assert.ok(me.ledger.some(e => e.reason === 'gift-card' && e.amount === 50));

  // An expired checkout that never held credit gives nothing back.
  const expired = (id, credit) => ({ id, type: 'checkout.session.expired', data: { object: { id: `cs_${id}`, payment_status: 'unpaid', metadata: { flow: 'quote', customerId: uid, creditApplied: String(credit) } } } });
  assert.equal((await webhook(expired('evt_exp_none', 20))).status, 200);
  assert.equal((await db.doc(`rewardWallets/${uid}`).get()).data().balance, 50);
  // One that held $20 gets it back, once.
  await db.doc(`rewardWallets/${uid}`).set({ balance: 30 }, { merge: true });
  await db.doc(`rewardWallets/${uid}/ledger/checkout-cs_evt_exp_held`).set({ amount: -20, reason: 'checkout', createdAt: Timestamp.now() });
  assert.equal((await webhook(expired('evt_exp_held', 20))).status, 200);
  assert.equal((await webhook(expired('evt_exp_held', 20))).status, 200);
  assert.equal((await db.doc(`rewardWallets/${uid}`).get()).data().balance, 50);
  assert.equal((await fetch(`${base}/gift-cards`)).status, 200);
});

test('price watch: real changes are listed, AI wobbles and missing prices are not', () => {
  const flat = { studio: null, oneBedroom: null, twoBedroom: 1200, threeBedroom: null, fourBedroom: null };
  const base = { published: true, twoMovers: 150, threeMovers: 200, fourMovers: null, minimumHours: 3, travelFee: 99, flat };
  assert.deepEqual(diffPrices(base, base), []);
  assert.deepEqual(diffPrices(null, base), []); // First reading: nothing to compare.
  assert.deepEqual(diffPrices(base, { ...base, published: false }), []);
  assert.deepEqual(diffPrices(base, { ...base, twoMovers: 152 }), []); // Under $5.
  assert.deepEqual(diffPrices(base, { ...base, threeMovers: null }), []); // Missing, not a change.
  const changes = diffPrices(base, { ...base, twoMovers: 165, minimumHours: 2, flat: { ...flat, twoBedroom: 1100 } });
  assert.deepEqual(changes.map(c => c.field), ['twoMovers', 'minimumHours', 'flat.twoBedroom']);
  assert.equal(describeChange(changes[0]), '2 movers/hr $150 → $165 (+10%)');
  assert.equal(describeChange(changes[1]), 'Minimum hours 3 → 2');
});

test('outreach tracker: admin-only; built-in list with saved status; custom entries can be added and removed', async () => {
  const get = token => fetch(`${base}/api/admin/outreach`, { headers: { Authorization: `Bearer ${token}` } });
  const post = (token, body) => fetch(`${base}/api/admin/outreach`, authorized(token, body));
  assert.equal((await get(customerToken)).status, 403);
  const first = await (await get(adminToken)).json();
  assert.ok(first.items.length >= 30);
  assert.equal(first.items.find(i => i.id === 'yelp').status, 'todo');
  assert.equal((await post(adminToken, { id: 'yelp', status: 'listed', listingUrl: 'https://www.yelp.com/biz/wont-stop-moving', notes: 'Owner: Jon' })).status, 200);
  assert.equal((await post(adminToken, { id: 'yelp', status: 'done?' })).status, 400);
  assert.equal((await post(adminToken, { id: 'not-a-thing', status: 'listed' })).status, 404);
  assert.equal((await post(adminToken, { id: 'yelp', action: 'remove' })).status, 400); // Built-ins can't be removed.
  const added = await (await post(adminToken, { action: 'add', name: 'Local Realtor Group', url: 'javascript:alert(1)', kind: 'other' })).json();
  const after = await (await get(adminToken)).json();
  const yelp = after.items.find(i => i.id === 'yelp');
  assert.equal(yelp.status, 'listed');
  assert.equal(yelp.listingUrl, 'https://www.yelp.com/biz/wont-stop-moving');
  const custom = after.items.find(i => i.id === added.id);
  assert.equal(custom.url, ''); // Only http(s) links are kept.
  assert.equal((await post(adminToken, { id: added.id, action: 'remove' })).status, 200);
  assert.ok(!(await (await get(adminToken)).json()).items.some(i => i.id === added.id));
});

test('concierge: customers ask for partner services on their own moves; admins introduce a partner (customer emailed once)', async () => {
  const uid = auth.currentUser.uid;
  await db.doc('jobs/concierge-job').set({ customerId: uid, status: 'confirmed', moveDate: '2027-01-15', pickupAddress: '94103', dropoffAddress: '94110', state: 'California' });
  await db.doc('jobs/concierge-other').set({ customerId: 'someone-else', status: 'confirmed' });
  const ask = body => fetch(`${base}/api/concierge`, authorized(customerToken, body));
  assert.equal((await ask({ jobId: 'concierge-job', service: 'spaceship' })).status, 400);
  assert.equal((await ask({ jobId: 'concierge-other', service: 'cleaning' })).status, 404);
  const created = await ask({ jobId: 'concierge-job', service: 'cleaning', note: 'Need it the day after' });
  assert.equal(created.status, 200);
  const { id } = await created.json();
  assert.equal((await ask({ jobId: 'concierge-job', service: 'cleaning' })).status, 409);
  const mine = await (await fetch(`${base}/api/concierge?jobId=concierge-job`, { headers: { Authorization: `Bearer ${customerToken}` } })).json();
  assert.equal(mine.requests.length, 1);

  const adminPost = body => fetch(`${base}/api/admin/concierge`, authorized(adminToken, body));
  assert.equal((await fetch(`${base}/api/admin/concierge`, authorized(customerToken, { action: 'partner', name: 'X', services: ['cleaning'] }))).status, 403);
  assert.equal((await adminPost({ action: 'partner', name: 'Sparkle Cleaners', services: [] })).status, 400);
  const partner = await (await adminPost({ action: 'partner', name: 'Sparkle Cleaners', services: ['cleaning'], phone: '415-555-0100', area: 'Bay Area' })).json();
  const before = (await db.collection('emailOutbox').get()).size;
  assert.equal((await adminPost({ action: 'request', id, status: 'introduced', partnerId: partner.id, referralFee: 40 })).status, 200);
  const req = (await db.doc(`conciergeRequests/${id}`).get()).data();
  assert.equal(req.partnerName, 'Sparkle Cleaners');
  assert.equal(req.referralFee, 40);
  const afterIntro = (await db.collection('emailOutbox').get()).size;
  assert.equal(afterIntro, before + 1);
  assert.equal((await adminPost({ action: 'request', id, status: 'introduced', partnerId: partner.id })).status, 200);
  assert.equal((await db.collection('emailOutbox').get()).size, afterIntro); // Introduced once.
});

test('move documents: chosen per move (interstate adds federal booklets, storage adds an agreement); signatures need a full name', async () => {
  const uid = auth.currentUser.uid;
  await db.doc('quotes/docs-quote').set({ customerId: uid, pickupZip: '94103', dropoffZip: '98101', details: JSON.stringify({ addOns: { storage: true } }) });
  await db.doc('jobs/docs-job').set({ customerId: uid, quoteId: 'docs-quote', status: 'confirmed' });
  await db.doc('jobs/docs-local').set({ customerId: uid, status: 'confirmed', pickupAddress: '94103', dropoffAddress: '94110' });
  const get = id => fetch(`${base}/api/move-documents?jobId=${id}`, { headers: { Authorization: `Bearer ${customerToken}` } }).then(r => r.json());
  const interstate = await get('docs-job');
  assert.equal(interstate.facts.interstate, true);
  assert.ok(['rights-responsibilities', 'ready-to-move', 'storage'].every(id => interstate.outstanding.includes(id)));
  const local = await get('docs-local');
  assert.equal(local.facts.interstate, false);
  assert.ok(!local.outstanding.includes('rights-responsibilities'));
  const sign = body => fetch(`${base}/api/move-documents`, authorized(customerToken, { jobId: 'docs-job', agree: true, ...body }));
  assert.equal((await sign({ docId: 'valuation', signedName: 'Test Customer' })).status, 400); // No choice made.
  assert.equal((await sign({ docId: 'order-for-service', signedName: 'Test' })).status, 400); // Not a full name.
  assert.equal((await sign({ docId: 'bill-of-lading', signedName: 'Test Customer' })).status, 400); // Signed on moving day.
  assert.equal((await sign({ docId: 'valuation', signedName: 'Test Customer', choice: 'full' })).status, 200);
  const after = await get('docs-job');
  assert.ok(!after.outstanding.includes('valuation'));
  assert.equal(after.signatures.find(s => s.docId === 'valuation').choice, 'full');
  assert.equal((await fetch(`${base}/api/move-documents?jobId=concierge-other`, { headers: { Authorization: `Bearer ${customerToken}` } })).status, 404);
});
