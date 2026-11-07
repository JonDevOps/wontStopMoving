import { NextResponse } from "next/server";
import { onboardingLinkFor } from "@/lib/server/connect";
import { errorResponse, requireRole, requireStripe, siteOrigin } from "@/lib/server/auth";

/** Returns a Stripe onboarding link for the signed-in provider's own payout account. */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["provider"]);
    requireStripe();
    const url = await onboardingLinkFor(user.uid, user.email, siteOrigin(req));
    return NextResponse.json({ url });
  } catch (error) {
    return errorResponse(error);
  }
}
