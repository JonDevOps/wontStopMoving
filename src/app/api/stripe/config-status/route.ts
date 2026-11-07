import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { errorResponse, requireRole } from "@/lib/server/auth";

/** Admin-only: shows whether Stripe is configured and in which mode. */
export async function GET(req: Request) {
  try {
    await requireRole(req, ["admin"]);
  } catch (error) {
    return errorResponse(error);
  }
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  const hasRealSecretKey =
    Boolean(secretKey) &&
    secretKey !== "sk_test_placeholder_key_required" &&
    (secretKey.startsWith("sk_test_") || secretKey.startsWith("sk_live_"));

  const mode = secretKey.startsWith("sk_live_")
    ? "live"
    : secretKey.startsWith("sk_test_") && hasRealSecretKey
    ? "test"
    : "placeholder";

  const hasWebhookSecret =
    Boolean(webhookSecret) && webhookSecret.startsWith("whsec_");

  let connectionValid = false;
  let errorMessage: string | null = null;

  if (hasRealSecretKey) {
    try {
      await stripe.balance.retrieve();
      connectionValid = true;
    } catch (err: any) {
      errorMessage = err.message || "Could not verify Stripe API key";
    }
  }

  return NextResponse.json({
    hasRealSecretKey,
    hasWebhookSecret,
    mode,
    connectionValid,
    errorMessage,
  });
}

