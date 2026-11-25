// Phone menu, hold loop, owner whisper and call log (#182, #169, #159).
// Sends Twilio-signed requests to the built site; no Twilio API calls are made.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import twilio from 'twilio';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { spawn } from 'node:child_process';

if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-wsm') throw new Error('Demo emulator required.');
const BUSINESS = '+18887416683', SID = 'AC' + '1'.repeat(32);
const app = initializeApp({ projectId: 'demo-wsm' }, 'phone-ivr'), db = getFirestore(app);
const callSid = n => 'CA' + String(n).padStart(32, '0');

// Starts its own copy of the built site with voice switched on (the shared test server keeps it off).
let server; const PORT = 9016, base = `http://127.0.0.1:${PORT}`;
async function hit(name, params, query = '') {
  const path = `/api/webhooks/twilio/${name}${query}`, body = { AccountSid: SID, ...params };
  const signature = twilio.getExpectedTwilioSignature('wsm-test-webhook-token', `https://wontstopmoving.com${path}`, body);
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signature }, body: new URLSearchParams(body) });
  return { status: res.status, xml: await res.text() };
}
const log = async sid => (await db.doc(`phoneInbox/${sid}`).get()).data();
before(async () => {
  const env = { ...process.env, GCLOUD_PROJECT: 'demo-wsm', TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: 'wsm-test-webhook-token', TWILIO_FROM_NUMBER: BUSINESS, TWILIO_VOICE_ENABLED: 'true', TWILIO_VOICEMAIL_ENABLED: 'false', TWILIO_TOLL_FREE_VERIFIED: 'false', ZOHO_SMTP_PASS: 'test-placeholder', GEMINI_API_KEY: '' };
  delete env.TWILIO_VOICE_FORWARD_TO;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(PORT)], { env, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`${base}/api/admin/phone`)).status === 401) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  await db.doc('users/phone-ivr-provider').set({ role: 'provider', name: 'Pat Mover', phone: '+14155550123' });
  await db.doc('phoneBlocklist/4155550666').set({ phone: '+14155550666' });
});
after(async () => { server?.kill(); await db.doc('users/phone-ivr-provider').delete(); await db.doc('phoneBlocklist/4155550666').delete(); await deleteApp(app); });

test('unknown callers must press a key; silence twice is logged as likely spam', async () => {
  const sid = callSid(1);
  const first = await hit('voice', { CallSid: sid, From: '+14155550100', To: BUSINESS });
  assert.equal(first.status, 200); assert.match(first.xml, /<Gather[^>]*numDigits="1"/); assert.match(first.xml, /press 1/);
  assert.equal((await log(sid)).status, 'menu');
  const retry = await hit('voice-menu', { CallSid: sid, From: '+14155550100', To: BUSINESS });
  assert.match(retry.xml, /voice-menu\?retry=1/);
  const done = await hit('voice-menu', { CallSid: sid, From: '+14155550100', To: BUSINESS }, '?retry=1');
  assert.match(done.xml, /<Hangup\/>/); assert.equal((await log(sid)).status, 'likely_spam');
});

test('blocked numbers are rejected; known providers skip the menu to dispatch', async () => {
  const blocked = await hit('voice', { CallSid: callSid(2), From: '+14155550666', To: BUSINESS });
  assert.match(blocked.xml, /<Reject/); assert.equal((await log(callSid(2))).status, 'blocked');
  const known = await hit('voice', { CallSid: callSid(3), From: '+14155550123', To: BUSINESS });
  assert.match(known.xml, /Welcome back, Pat/); assert.match(known.xml, /voice-menu\?auto=2/);
  assert.equal((await log(callSid(3))).knownRole, 'provider');
});

test('a choice with no owner phone configured goes to the missed-call message and is logged for callback', async () => {
  const sid = callSid(4);
  await hit('voice', { CallSid: sid, From: '+14155550101', To: BUSINESS });
  const menu = await hit('voice-menu', { CallSid: sid, From: '+14155550101', To: BUSINESS, Digits: '1' });
  assert.match(menu.xml, /voice-complete/);
  assert.equal((await log(sid)).choice, 'booking');
  const end = await hit('voice-complete', { CallSid: sid, From: '+14155550101', To: BUSINESS });
  assert.match(end.xml, /will call you back/); assert.equal((await log(sid)).status, 'missed');
});

test('hold loop plays music and the wait message, then leaves after 90 seconds', async () => {
  const early = await hit('voice-hold', { CallSid: callSid(5), QueueTime: '20' });
  assert.match(early.xml, /hold-music\.wav/); assert.match(early.xml, /Your call is important to us/);
  assert.match((await hit('voice-hold', { CallSid: callSid(5), QueueTime: '91' })).xml, /<Leave\/>/);
});

test('owner whisper reads the caller and only connects on a key press', async () => {
  const sid = callSid(6);
  await hit('voice', { CallSid: sid, From: '+14155550102', To: BUSINESS });
  const whisper = await hit('voice-agent', { CallSid: callSid(7), From: BUSINESS, To: '+15555550000' }, `?call=${sid}&choice=0`);
  assert.match(whisper.xml, /4 1 5, 5 5 5, 0 1 0 2/); assert.match(whisper.xml, /customer support/); assert.match(whisper.xml, /Press 1 to connect/);
  assert.match((await hit('voice-agent-accept', { CallSid: callSid(7), From: BUSINESS, To: '+15555550000', Digits: '9' }, `?call=${sid}`)).xml, /not connected/);
  const accept = await hit('voice-agent-accept', { CallSid: callSid(7), From: BUSINESS, To: '+15555550000', Digits: '1' }, `?call=${sid}`);
  assert.match(accept.xml, new RegExp(`<Queue>wsm-${sid}</Queue>`)); assert.equal((await log(sid)).status, 'answered');
  assert.match((await hit('voice-complete', { CallSid: sid, To: BUSINESS, QueueResult: 'bridged' })).xml, /<Hangup\/>/);
});

test('a caller who hangs up on hold is marked for callback', async () => {
  const sid = callSid(8);
  await hit('voice', { CallSid: sid, From: '+14155550103', To: BUSINESS });
  await hit('voice-complete', { CallSid: sid, To: BUSINESS, QueueResult: 'hangup', QueueTime: '40' });
  const entry = await log(sid);
  assert.equal(entry.status, 'caller_hung_up'); assert.equal(entry.queueSeconds, 40);
});
