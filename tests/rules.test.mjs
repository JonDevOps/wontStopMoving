// Firestore rules tests. Run with:
//   firebase emulators:exec --only firestore --project demo-wsm "npm run test:rules"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore';

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
    await setDoc(doc(ctx.firestore(), 'users/cust'), { role: 'customer', email: 'cust@example.com' });
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
