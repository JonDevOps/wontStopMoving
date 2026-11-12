import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { CONCIERGE_SERVICES, isConciergeService, isConciergeStatus } from '@/lib/concierge';

const iso = (v: any) => v?.toDate?.().toISOString() || null;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Concierge requests and the partner list. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const db = adminDb();
    const [requests, partners] = await Promise.all([
      db.collection('conciergeRequests').orderBy('createdAt', 'desc').limit(300).get(),
      db.collection('conciergePartners').limit(500).get(),
    ]);
    return NextResponse.json({
      requests: requests.docs.map(d => { const r = d.data(); return { id: d.id, ...r, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) }; }),
      partners: partners.docs.map(d => { const p = d.data(); return { id: d.id, ...p, createdAt: iso(p.createdAt) }; }).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

/**
 * action 'partner': add or edit a partner. action 'request': update a
 * request's status, partner and referral fee; introducing a partner emails
 * the customer the partner's contact details.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['admin']);
    const body = await readJson(req);
    const db = adminDb();
    if (body.action === 'partner') {
      const name = text(body.name, 120);
      if (name.length < 2) throw new HttpError(400, 'Enter the partner’s name.');
      const services = Array.isArray(body.services) ? body.services.filter(isConciergeService) : [];
      if (!services.length) throw new HttpError(400, 'Choose at least one service.');
      const data = {
        name, services, phone: text(body.phone, 40), email: text(body.email, 254), website: /^https?:\/\//i.test(text(body.website, 300)) ? text(body.website, 300) : '',
        area: text(body.area, 200), feeNote: text(body.feeNote, 200), active: body.active !== false, updatedAt: FieldValue.serverTimestamp(),
      };
      if (isId(body.id)) { await db.doc(`conciergePartners/${body.id}`).set(data, { merge: true }); return NextResponse.json({ id: body.id }); }
      const ref = await db.collection('conciergePartners').add({ ...data, createdBy: user.uid, createdAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ id: ref.id });
    }
    if (body.action !== 'request' || !isId(body.id)) throw new HttpError(400, 'Choose a request.');
    if (!isConciergeStatus(body.status)) throw new HttpError(400, 'Choose a status.');
    const ref = db.doc(`conciergeRequests/${body.id}`);
    const current = (await ref.get()).data();
    if (!current) throw new HttpError(404, 'Request not found.');
    let partner: FirebaseFirestore.DocumentData | undefined;
    if (isId(body.partnerId)) {
      partner = (await db.doc(`conciergePartners/${body.partnerId}`).get()).data();
      if (!partner) throw new HttpError(404, 'Partner not found.');
    }
    const fee = typeof body.referralFee === 'number' && Number.isFinite(body.referralFee) && body.referralFee >= 0 ? Math.round(body.referralFee * 100) / 100 : current.referralFee ?? null;
    await ref.update({
      status: body.status, adminNote: text(body.adminNote, 1000), referralFee: fee, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp(),
      ...(partner ? { partnerId: body.partnerId, partnerName: partner.name } : {}),
    });
    if (partner && body.status === 'introduced' && current.status === 'new' && current.customerEmail) {
      const label = CONCIERGE_SERVICES[current.service as keyof typeof CONCIERGE_SERVICES]?.label || current.service;
      await enqueueEmail(`concierge-intro:${body.id}`, {
        category: 'concierge', referenceId: body.id, to: current.customerEmail,
        subject: `Your ${label.toLowerCase()} partner: ${partner.name}`,
        text: `Hi ${current.customerName || 'there'},\n\nFor ${label.toLowerCase()} with your move, we recommend ${partner.name}.${partner.phone ? `\nPhone: ${partner.phone}` : ''}${partner.email ? `\nEmail: ${partner.email}` : ''}${partner.website ? `\nWebsite: ${partner.website}` : ''}\n\nMention Wont Stop Moving when you contact them. They know you're coming.\n\nQuestions? Reply to this email or call (415) 214-5474.\n\nWont Stop Moving`,
      }).catch(error => console.error('Concierge intro email failed', body.id, error));
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
