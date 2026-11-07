import { NextResponse } from "next/server";
import { refreshConnectStatus } from "@/lib/server/connect";
import { errorResponse, requireRole, requireStripe } from "@/lib/server/auth";

/** Payout-account status for the signed-in provider only. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["provider"]);
    requireStripe();
    return NextResponse.json(await refreshConnectStatus(user.uid));
  } catch (error) {
    return errorResponse(error);
  }
}
