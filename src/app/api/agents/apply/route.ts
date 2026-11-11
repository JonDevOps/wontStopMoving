import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireUser } from '@/lib/server/auth';
import { enqueueEmail } from '@/lib/server/notifications';
import { vetAgent } from '@/lib/server/network-monitor';
import { AGENT_AGREEMENT_VERSION, checkAgentApplication, REGION_BY_CODE } from '@/lib/agents';

/**
 * A moving company applies to the agent network. The signed-in account
 * becomes an agent account with a pending application that an admin vets.
 * Written server-side only: browsers can't write agent records.
 */
export async function POST(req: Request) {
  try {
    const token = await requireUser(req);
    const checked = checkAgentApplication(await readJson(req));
    if (!checked.ok) throw new HttpError(400, checked.error);
    const app = checked.data;
    const email = token.email || '';
    if (!email) throw new HttpError(400, 'Your sign-in has no email address.');
    const db = adminDb(), userRef = db.doc(`users/${token.uid}`), agentRef = db.doc(`agents/${token.uid}`);

    await db.runTransaction(async tx => {
      const [profile, agent] = await Promise.all([tx.get(userRef), tx.get(agentRef)]);
      const role = profile.data()?.role;
      if (role && role !== 'agent') throw new HttpError(409, `This sign-in is already a ${role} account. Use a different email for your company.`);
      const status = agent.data()?.status;
      if (status && status !== 'pending') throw new HttpError(409, 'Your company is already in the network. Update your details from the agent dashboard.');
      tx.set(userRef, { id: token.uid, email, name: app.contactName, phone: app.phone, role: 'agent', state: app.region, ...(profile.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
      tx.set(agentRef, {
        uid: token.uid, email, ...app, agreementAccepted: true, agreementVersion: AGENT_AGREEMENT_VERSION, agreementAcceptedAt: FieldValue.serverTimestamp(),
        status: 'pending', ...(agent.exists ? { updatedAt: FieldValue.serverTimestamp() } : { vetting: {}, appliedAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
    });

    // Check FMCSA right away: ticks the authority/insurance vetting boxes when confirmed.
    if (app.usdot) { try { await vetAgent(token.uid); } catch (error) { console.error('Federal check failed', token.uid, error); } }
    const where = `${app.city}, ${REGION_BY_CODE.get(app.region)?.name || app.region}`;
    try {
      await enqueueEmail(`agent-applied:${token.uid}`, {
        category: 'agent', referenceId: token.uid, to: process.env.ADMIN_NOTIFICATION_EMAIL || 'jonathan@w3develops.org',
        subject: `Agent network application: ${app.companyName} (${where})`,
        text: `${app.companyName} applied to the agent network.\n\nContact: ${app.contactName} · ${app.phone} · ${email}\nLocation: ${where}\nUSDOT: ${app.usdot || '—'} · MC: ${app.mcNumber || '—'}${app.otherAuthority ? ` · ${app.otherAuthority}` : ''}\nTrucks: ${app.trucks} · Tractors: ${app.tractors} · Warehouse: ${app.warehouseSqft.toLocaleString()} sq ft · Staff: ${app.employees}\nServes: ${app.serviceRegions.length} states/provinces\n\nVet them:\nhttps://wontstopmoving.com/dashboard/admin/agents\n\nWont Stop Moving`,
      });
      await enqueueEmail(`agent-received:${token.uid}`, {
        category: 'agent', referenceId: token.uid, to: email,
        subject: 'We received your agent network application',
        text: `Hi ${app.contactName},\n\nThanks for applying to join the Wont Stop Moving agent network with ${app.companyName}. Our team will verify your operating authority, insurance and references, usually within a few business days, and email you when you're approved.\n\nYou can check your status any time:\nhttps://wontstopmoving.com/dashboard/agent\n\nQuestions? Call (415) 214-5474 or reply to this email.\n\nWont Stop Moving`,
      });
    } catch (error) { console.error('Agent application emails failed', token.uid, error); }
    return NextResponse.json({ status: 'pending' }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
