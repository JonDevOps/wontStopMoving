import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { supportStatusSchema } from '@/lib/support';
import { newFeedbackToken, sendResolutionEmail } from '@/lib/server/service-desk';

export async function PATCH(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { ticketId } = await params;
    if (!isId(ticketId)) throw new HttpError(400, 'Invalid ticket.');
    const status = supportStatusSchema.safeParse((await readJson(req)).status);
    if (!status.success) throw new HttpError(400, 'Choose a valid ticket status.');
    const ref = adminDb().doc(`supportTickets/${ticketId}`);
    const resolved = await adminDb().runTransaction(async tx => {
      const t = (await tx.get(ref)).data();
      if (!t) throw new HttpError(404, 'Ticket not found.');
      // Moving a ticket out of "new" counts as the first response (for response-time targets).
      const firstResponse = status.data !== 'new' && !t.firstResponseAt ? { firstResponseAt: FieldValue.serverTimestamp() } : {};
      const nowResolved = status.data === 'resolved' && t.status !== 'resolved';
      const token = nowResolved ? newFeedbackToken() : null;
      tx.update(ref, { status: status.data, ...firstResponse, ...(token ? { feedbackToken: token, resolvedAt: FieldValue.serverTimestamp() } : {}), updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid });
      return token && t.email ? { token, email: t.email as string, name: String(t.name || '').split(' ')[0], subject: String(t.subject || 'your question') } : null;
    });
    // Ask how we did. Keyed per ticket, so re-resolving never sends twice.
    if (resolved) await sendResolutionEmail({ kind: 'ticket', id: ticketId, token: resolved.token, to: resolved.email, name: resolved.name, subject: resolved.subject, message: 'We\'ve marked your question as resolved. Thanks for contacting Wont Stop Moving.' });
    return NextResponse.json({ status: status.data });
  } catch (error) { return errorResponse(error); }
}
