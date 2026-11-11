import { spawn } from 'node:child_process';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this through firebase emulators:exec --only auth,firestore --project demo-wsm.');
}
const base = 'http://127.0.0.1:9014';
// Registry files go to a temp folder instead of Cloud Storage during tests.
const registryDir = (await import('node:fs')).mkdtempSync((await import('node:path')).join((await import('node:os')).tmpdir(), 'wsm-registry-'));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '9014'], {
  env: { ...process.env, GCLOUD_PROJECT: 'demo-wsm', STRIPE_SECRET_KEY: 'sk_test_placeholder_key_required', STRIPE_WEBHOOK_SECRET: 'whsec_integration_test', STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_integration_test',
    // Never send real email from tests, even when .env.local holds Zoho credentials:
    // a placeholder password marks mail as not configured, and the host is unroutable.
    ZOHO_SMTP_USER: 'test@example.com', ZOHO_SMTP_PASS: 'test-placeholder', ZOHO_SMTP_HOST: '127.0.0.1', ZOHO_SMTP_PORT: '9', ADMIN_NOTIFICATION_EMAIL: 'admin-alerts@example.com',
    CRON_SERVICE_ACCOUNT: 'scheduler@example.iam.gserviceaccount.com', GEMINI_API_KEY: '', TYPESAFE_API_KEY: '', REGISTRY_LOCAL_DIR: registryDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(`${base}/api/admin/support`)).status === 401) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error(`Local test server did not start. ${logs}`);
  const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', 'tests/rules.test.mjs', 'tests/support-integration.test.mjs'], {
    env: { ...process.env, GCLOUD_PROJECT: 'demo-wsm', SUPPORT_TEST_BASE_URL: base, REGISTRY_LOCAL_DIR: registryDir }, stdio: 'inherit',
  });
  process.exitCode = await new Promise(resolve => tests.on('exit', code => resolve(code ?? 1)));
  if (process.exitCode) console.error(logs);
} finally { server.kill('SIGTERM'); }
