import { NextResponse } from 'next/server';
import { createMoverCheckout } from '@/lib/server/mover-checkout';
import { errorResponse, readJson, requireRole, siteOrigin } from '@/lib/server/auth';

export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['customer', 'admin']);
    return NextResponse.json(await createMoverCheckout(user.uid, user.email, await readJson(req), siteOrigin(req)));
  } catch (error) { return errorResponse(error); }
}
