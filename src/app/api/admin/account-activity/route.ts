import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';

export async function POST(req: Request) {
  try {
    await requireRole(req, ['admin']);
    const { uids } = await readJson(req);
    if (!Array.isArray(uids) || !uids.length || uids.length > 100 || !uids.every(id => isId(id))) throw new HttpError(400, 'Choose between 1 and 100 accounts.');
    const result = await adminAuth().getUsers([...new Set(uids)].map(uid => ({ uid })));
    return NextResponse.json({ accounts: Object.fromEntries(result.users.map(user => [user.uid, { createdAt: user.metadata.creationTime || null, lastSignInAt: user.metadata.lastSignInTime || null }])) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
