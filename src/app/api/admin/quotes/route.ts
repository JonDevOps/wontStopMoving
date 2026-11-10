import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole, siteOrigin } from '@/lib/server/auth';
import { customQuoteSchema } from '@/lib/custom-quotes';
import { queueQuoteEmail } from '@/lib/server/notifications';

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const result = customQuoteSchema.safeParse(await readJson(req));
    if (!result.success) throw new HttpError(400, result.error.issues[0]?.message || 'Check your quote details.');
    const data = result.data;
    const expiry = Date.parse(data.expiresAt);
    if (expiry <= Date.now() || expiry > Date.now() + 366 * 86400000) throw new HttpError(400, 'Choose an expiry within the next year.');
    const ref = adminDb().collection('quotes').doc();
    await ref.set({ ...data, expiresAt: Timestamp.fromMillis(expiry), customerId: '', isCustomQuote: true, moveSize: 'custom', status: 'new', createdBy: user.uid, createdAt: FieldValue.serverTimestamp() });
    // Email the customer their private quote link. A mail problem must not lose
    // the quote, which the admin can still share by copying the link.
    let emailStatus = 'failed';
    try { emailStatus = (await queueQuoteEmail(ref.id)).status; } catch (error) { console.error('Custom quote email failed', ref.id, error); }
    return NextResponse.json({ id: ref.id, url: `${siteOrigin(req)}/custom-quotes/${ref.id}`, emailStatus }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
