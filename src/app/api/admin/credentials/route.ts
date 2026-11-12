import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { EMPTY_PROFILE, isBackgroundStatus, profileIssues, type MoverProfile } from '@/lib/mover-profile';

/** Every mover's credentials and open issues (blocking first). */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [providers, compliance] = await Promise.all([
      db.collection('providers').select('name', 'email', 'status', 'hasDotVehicle', 'stripeOnboardingComplete').limit(1000).get(),
      db.collection('providerCompliance').limit(1000).get(),
    ]);
    const byId = new Map(compliance.docs.map(d => [d.id, d.data()]));
    const movers = providers.docs.map(p => {
      const c = byId.get(p.id) || {};
      const profile = { ...EMPTY_PROFILE, ...c, backgroundStatus: isBackgroundStatus(c.backgroundStatus) ? c.backgroundStatus : 'not-started' } as MoverProfile;
      const issues = profileIssues(profile, { needsDot: p.data().hasDotVehicle === true });
      return { uid: p.id, name: p.data().name || '', email: p.data().email || '', status: p.data().status || '', stripeReady: p.data().stripeOnboardingComplete === true, profile: { ...profile, backgroundConsentAt: c.backgroundConsentAt?.toDate?.().toISOString() || null }, issues, blocking: issues.some(i => i.blocking) };
    }).sort((a, b) => Number(b.blocking) - Number(a.blocking) || a.name.localeCompare(b.name));
    return NextResponse.json({ movers }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Record a background check result. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    if (!isId(body.uid)) throw new HttpError(400, 'Choose a mover.');
    if (!isBackgroundStatus(body.backgroundStatus)) throw new HttpError(400, 'Choose a result.');
    if (!(await adminDb().doc(`providers/${body.uid}`).get()).exists) throw new HttpError(404, 'Mover not found.');
    await adminDb().doc(`providerCompliance/${body.uid}`).set({
      backgroundStatus: body.backgroundStatus, backgroundNote: typeof body.note === 'string' ? body.note.slice(0, 500) : '',
      backgroundUpdatedBy: user.uid, backgroundUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
