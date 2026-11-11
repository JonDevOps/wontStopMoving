import { NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/server/auth';
import { claimAdminInvite } from '@/lib/server/admin-invites';

/** Called right after sign-in: grants admin if this verified email was invited. */
export async function POST(req: Request) {
  try {
    const token = await requireUser(req);
    return NextResponse.json({ admin: await claimAdminInvite(token) });
  } catch (error) { return errorResponse(error); }
}
