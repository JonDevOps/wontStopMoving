import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../src/lib/server/firebase-admin.ts';
import { emailProviderConfigured } from '../src/lib/server/email-provider.ts';
import { deliverEmail } from '../src/lib/server/email-outbox.ts';

const inboxTest = process.argv[2] === '--owner-inbox';
const approval = inboxTest ? 'SES_REAL_INBOX_APPROVED' : 'SES_SIMULATOR_APPROVED';
if (process.env[approval] !== 'true') throw new Error(`Set ${approval}=true only after the owner approves these test emails.`);
if (process.env.GCLOUD_PROJECT !== 'studio-6652665935-1850d' || process.env.FIRESTORE_EMULATOR_HOST || !emailProviderConfigured('ses')) {
  throw new Error('Set the WontStopMoving Google project explicitly and configure the pilot SES identity before testing.');
}
const runId = process.env.SES_SIMULATOR_RUN_ID;
if (!runId || !/^[a-zA-Z0-9_-]{4,40}$/.test(runId)) {
  throw new Error('Set a unique SES_SIMULATOR_RUN_ID (4-40 letters, numbers, dashes or underscores).');
}

const cases = inboxTest ? [['owner-inbox', 'jonathan@w3develops.org']] : [
  ['success', 'success@simulator.amazonses.com'],
  ['hard-bounce', 'bounce@simulator.amazonses.com'],
  ['complaint', 'complaint@simulator.amazonses.com'],
];

for (const [name, to] of cases) {
  const id = createHash('sha256').update(`ses-simulator:${runId}:${name}`).digest('hex');
  const db = adminDb(), ref = db.doc(`sesPilotOutbox/${id}`);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, {
      to, subject: `TEST — WontStopMoving SES — ${name} — ${runId}`,
      text: 'Approved AWS email delivery test for WontStopMoving.', status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });
  });
  const status = await deliverEmail(id, true);
  console.log(JSON.stringify({ name, outboxId: id, status }));
  if (!['accepted', 'delivered', 'bounced', 'complained'].includes(status)) process.exitCode = 1;
}
