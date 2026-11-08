import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { supportStatusSchema } from '@/lib/support';

export async function PATCH(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const { ticketId } = await params;
    if (!isId(ticketId)) throw new HttpError(400, 'Invalid ticket.');
    const status = supportStatusSchema.safeParse((await readJson(req)).status);
    if (!status.success) throw new HttpError(400, 'Choose a valid ticket status.');
    const ref = adminDb().doc(`supportTickets/${ticketId}`);
    await adminDb().runTransaction(async tx => {
      if (!(await tx.get(ref)).exists) throw new HttpError(404, 'Ticket not found.');
      tx.update(ref, { status: status.data, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid });
    });
    return NextResponse.json({ status: status.data });
  } catch (error) { return errorResponse(error); }
}
