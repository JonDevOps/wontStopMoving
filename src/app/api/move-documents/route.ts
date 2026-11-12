import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { clientIp } from '@/lib/server/rate-limit';
import { ZIP_COUNTY } from '@/lib/server/geo';
import { MOVE_DOCS_VERSION, documentsFor, isValuationChoice, outstanding, type MoveDocId, type Signature } from '@/lib/move-documents';

const zip5 = (v: unknown) => (String(v || '').match(/\b\d{5}\b/) || [''])[0];
const stateFips = (zip: string) => (ZIP_COUNTY[zip] || '').slice(0, 2);

/** The move's facts (interstate? storage?) from the job and its quote. */
async function load(jobId: string, uid: string, isAdmin: boolean) {
  const db = adminDb();
  const job = (await db.doc(`jobs/${jobId}`).get()).data();
  if (!job || (!isAdmin && job.customerId !== uid)) throw new HttpError(404, 'Move not found.');
  const quote = job.quoteId ? (await db.doc(`quotes/${job.quoteId}`).get()).data() : null;
  let details: Record<string, any> = {};
  try { details = typeof quote?.details === 'string' ? JSON.parse(quote.details) : quote?.details || {}; } catch { details = {}; }
  const from = stateFips(zip5(quote?.pickupZip || details.pickupZip || job.pickupAddress));
  const to = stateFips(zip5(quote?.dropoffZip || details.dropoffZip || job.dropoffAddress));
  const facts = { interstate: !!from && !!to && from !== to, storage: !!details.addOns?.storage };
  const docs = documentsFor(facts);
  const saved = (await db.doc(`moveDocuments/${jobId}`).get()).data();
  const signatures: Signature[] = Object.values((saved?.signatures || {}) as Record<string, any>).map(s => ({
    docId: s.docId, signedName: s.signedName, choice: s.choice || null, version: s.version, at: s.at?.toDate?.().toISOString() || null,
  }));
  return { job, facts, docs, signatures };
}

export async function GET(req: Request) {
  try {
    const { user, role } = await requireRole(req, ['customer', 'admin']);
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!isId(jobId)) throw new HttpError(400, 'Choose a move.');
    const { facts, docs, signatures } = await load(jobId, user.uid, role === 'admin');
    return NextResponse.json({ facts, docs, signatures, outstanding: outstanding(docs, signatures).map(d => d.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/** Sign or acknowledge one document (once per document and version). */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer']);
    const body = await readJson(req);
    if (!isId(body.jobId)) throw new HttpError(400, 'Choose a move.');
    const { job, docs } = await load(body.jobId, user.uid, false);
    if (job.status === 'cancelled' || job.status === 'completed') throw new HttpError(409, `This move is ${job.status}.`);
    const doc = docs.find(d => d.id === body.docId);
    if (!doc || doc.kind === 'info') throw new HttpError(400, 'Choose a document to sign.');
    if (body.agree !== true) throw new HttpError(400, 'Check the box to confirm.');
    const signedName = typeof body.signedName === 'string' ? body.signedName.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
    if (signedName.length < 3 || !/\s/.test(signedName)) throw new HttpError(400, 'Type your full name to sign.');
    if (doc.id === 'valuation' && !isValuationChoice(body.choice)) throw new HttpError(400, 'Choose how your belongings are protected.');
    const id = doc.id as MoveDocId;
    await adminDb().doc(`moveDocuments/${body.jobId}`).set({
      customerId: user.uid, updatedAt: FieldValue.serverTimestamp(),
      signatures: { [id]: {
        docId: id, signedName, choice: id === 'valuation' ? body.choice : null, version: MOVE_DOCS_VERSION, uid: user.uid,
        ip: clientIp(req), userAgent: (req.headers.get('user-agent') || '').slice(0, 300), at: FieldValue.serverTimestamp(),
      } },
    }, { merge: true });
    return NextResponse.json({ signed: id });
  } catch (error) { return errorResponse(error); }
}
