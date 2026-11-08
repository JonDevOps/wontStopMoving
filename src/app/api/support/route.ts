import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError } from '@/lib/server/auth';
import { supportInquirySchema } from '@/lib/support';

/** Public intake; ticket reads and updates are available only through admin APIs. */
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin &&
        !['https://wontstopmoving.com', 'https://www.wontstopmoving.com'].includes(origin)) {
      throw new HttpError(403, 'Please send your message from our contact page.');
    }
    if (!req.headers.get('content-type')?.includes('application/json')) {
      throw new HttpError(415, 'Send your message as JSON.');
    }
    // Bound the streamed body as well as the declared length.
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError(400, 'Please enter a message.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32000) {
        await reader.cancel();
        throw new HttpError(413, 'Your message is too long.');
      }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HttpError(400, 'Please check your message and try again.'); }
    const parsed = supportInquirySchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, 'Enter a valid name, email, subject and a message of 10–5,000 characters.');
    if (parsed.data.website) throw new HttpError(400, 'Unable to submit this message. Please email support@wontstopmoving.com.');
    const { website, ...inquiry } = parsed.data;
    const db = adminDb();
    const ticket = db.collection('supportTickets').doc();
    // Persistent, transactional limit: survives restarts and multiple instances.
    // The hash avoids copying email addresses into a second collection.
    const hash = createHash('sha256').update(inquiry.email.toLowerCase()).digest('hex');
    const rate = db.doc(`supportIntakeLimits/${hash}`);
    await db.runTransaction(async tx => {
      const previous = (await tx.get(rate)).data();
      const now = Date.now();
      const inWindow = previous?.windowStart?.toMillis() > now - 3600000;
      if (inWindow && previous!.count >= 5) {
        throw new HttpError(429, 'Too many messages. Please wait an hour or email support@wontstopmoving.com.');
      }
      tx.set(rate, { count: inWindow ? previous!.count + 1 : 1,
        windowStart: inWindow ? previous!.windowStart : Timestamp.fromMillis(now) });
      tx.create(ticket, { ...inquiry, status: 'new', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ticketId: ticket.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
