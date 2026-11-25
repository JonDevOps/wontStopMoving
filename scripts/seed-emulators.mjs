// Seeds the local Firebase emulators with test accounts and sample data.
// Run with `npm run seed:local` while `npm run emulators` is running.
// Refuses to run unless both emulator hosts are set, so it can never touch production.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Emulator hosts are not set. Use `npm run seed:local`.');
}

initializeApp({ projectId: 'studio-6652665935-1850d' });
const auth = getAuth(), db = getFirestore();
const PASSWORD = 'password123';

async function account(uid, email, name, role, extra = {}) {
  try { await auth.createUser({ uid, email, password: PASSWORD, displayName: name, emailVerified: true }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  await db.doc(`users/${uid}`).set({ name, email, role, phone: extra.phone || '', state: 'CA', createdAt: FieldValue.serverTimestamp(), ...extra }, { merge: true });
}

await account('dev-admin', 'admin@wsm.test', 'Dev Admin', 'admin', { phone: '4155550100' });
await account('dev-employee', 'rep@wsm.test', 'Dev Rep', 'employee', { phone: '4155550101' });
await account('dev-customer', 'customer@wsm.test', 'Casey Customer', 'customer', { phone: '4155550102' });
await account('dev-provider', 'provider@wsm.test', 'Pat Provider', 'provider', { phone: '4155550103' });

await db.doc('providers/dev-provider').set({
  businessName: 'Golden Gate Test Movers', bio: 'Two-person crew for apartments and small homes.',
  status: 'approved', hourlyRate: 65, minimumHours: 2, services: ['loading', 'unloading', 'packing'],
  serviceAreaCities: ['ca/san-francisco', 'ca/oakland'], rating: 4.8, reviewCount: 12,
  location: { lat: 37.7599, lng: -122.4148 }, geohash: geohashForLocation([37.7599, -122.4148]), featured: true,
  stripeAccountId: 'acct_devtestprovider', stripeOnboardingComplete: true,
  email: 'provider@wsm.test', phone: '4155550103', createdAt: FieldValue.serverTimestamp(),
}, { merge: true });

const now = Date.now();
await db.doc('quotes/dev-quote-1').set({
  name: 'Casey Customer', email: 'customer@wsm.test', phone: '4155550102',
  pickupZip: '94110', dropoffZip: '94607', pickupAddress: '123 Valencia St, 94110', dropoffAddress: '456 Broadway, 94607',
  moveDate: new Date(now + 14 * 86400000).toISOString().slice(0, 10), moveSize: '1br', specialItems: '',
  estimatedTotal: 980, customerId: 'dev-customer', status: 'new',
  leadSource: { landingPath: '/services/local-moving', referrerHost: 'www.google.com', pagesVisited: ['/services/local-moving', '/faq', '/quote'] },
  createdAt: Timestamp.fromMillis(now - 3 * 60000),
  details: JSON.stringify({ moveSize: '1br', addOns: { packing: true } }),
}, { merge: true });

await db.doc('jobs/dev-job-1').set({
  customerId: 'dev-customer', customerName: 'Casey Customer', providerIds: ['dev-provider'], employeeIds: [],
  status: 'scheduled', moveSize: '1br', price: 980, state: 'CA',
  pickupAddress: '123 Valencia St, San Francisco, CA 94110', dropoffAddress: '456 Broadway, Oakland, CA 94607',
  moveDate: new Date(now + 14 * 86400000).toISOString().slice(0, 10), createdAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`Seeded the emulators. Sign in at http://localhost:9002/login with password "${PASSWORD}":
  admin@wsm.test     (admin)
  rep@wsm.test       (employee)
  customer@wsm.test  (customer)
  provider@wsm.test  (provider)`);
process.exit(0);
