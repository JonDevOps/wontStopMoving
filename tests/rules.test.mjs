// Firestore rules tests. Run with:
//   firebase emulators:exec --only firestore --project demo-wsm "npm run test:rules"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, addDoc, collection } from 'firebase/firestore';

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

test('a new signup cannot make itself admin with the old invite flag', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/mallory'), { role: 'admin', adminInviteVerified: true }));
});

test('a new signup using the admin@ email cannot make itself admin', async () => {
  const db = as('m2', { email: 'admin@wontstopmoving.com', email_verified: true });
  await assertFails(setDoc(doc(db, 'users/m2'), { role: 'admin' }));
});

test('normal signups still work for customer, employee and provider', async () => {
  for (const role of ['customer', 'employee', 'provider']) {
    await assertSucceeds(setDoc(doc(as(`u-${role}`), `users/u-${role}`), { role }));
  }
});

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

test('reviews: only the customer of a completed job, once', async () => {
  const review = { jobId: 'done', customerId: 'cust', rating: 5, comment: 'Great' };
  await assertFails(setDoc(doc(as('prov'), 'providers/prov/reviews/done'), { ...review, customerId: 'prov' }));
  await assertFails(setDoc(doc(as('cust'), 'providers/prov/reviews/j1'), { ...review, jobId: 'j1' }));
  await assertFails(addDoc(collection(as('cust'), 'providers/prov/reviews'), review));
  await assertSucceeds(setDoc(doc(as('cust'), 'providers/prov/reviews/done'), review));
  await assertFails(setDoc(doc(as('cust'), 'providers/prov/reviews/done'), { ...review, rating: 1 }));
});
