import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();
    if (!accountId) throw new Error("Missing accountId");

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:9002";
    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const isPlaceholder = !secretKey || secretKey.includes("placeholder");

    if (accountId.startsWith("acct_demo_") || isPlaceholder) {
      return NextResponse.json({
        url: `${origin}/dashboard/provider?stripe_demo=connected`,
        demo: true,
      });
    }

    try {
      const redirectBase =
        secretKey.startsWith("sk_live_") && origin.startsWith("http://localhost")
          ? "https://wontstopmoving.com"
          : origin;

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${redirectBase}/dashboard/provider`,
        return_url: `${redirectBase}/dashboard/provider`,
        type: "account_onboarding",
      });

      return NextResponse.json({ url: accountLink.url });
    } catch (connectErr: any) {
      console.warn(
        "Stripe accountLink fallback triggered:",
        connectErr?.message || connectErr
      );
      return NextResponse.json({
        url: `${origin}/dashboard/provider?stripe_demo=connected`,
        demo: true,
        notice: connectErr?.message,
      });
    }
  } catch (error: any) {
    console.error("Stripe accountLink error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
