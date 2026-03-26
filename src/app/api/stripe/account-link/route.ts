import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();
    if (!accountId) throw new Error("Missing accountId");

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9002";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/provider`,
      return_url: `${origin}/dashboard/provider`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe accountLink error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
