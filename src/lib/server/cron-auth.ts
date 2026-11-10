import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies a Google Cloud Scheduler call: a Google-signed ID token for
 * CRON_SERVICE_ACCOUNT, issued for this exact URL (the audience). No shared
 * secret is stored anywhere.
 */
const verifier = new OAuth2Client();

export async function isSchedulerRequest(req: Request, path: string): Promise<boolean> {
  const allowed = process.env.CRON_SERVICE_ACCOUNT;
  const token = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/)?.[1];
  if (!allowed || !token) return false;
  try {
    const audience = `${process.env.CRON_AUDIENCE_ORIGIN || 'https://wontstopmoving.com'}${path}`;
    const payload = (await verifier.verifyIdToken({ idToken: token, audience })).getPayload();
    return payload?.email === allowed && payload.email_verified === true;
  } catch { return false; }
}
