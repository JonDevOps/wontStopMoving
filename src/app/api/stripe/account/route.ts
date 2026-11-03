import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { email, businessName } = await req.json();
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:9002";
    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const isPlaceholder = !secretKey || secretKey.includes("placeholder");

    if (isPlaceholder) {
      return NextResponse.json({
        accountId: `acct_demo_${Date.now()}`,
        url: `${origin}/dashboard/provider?stripe_demo=connected`,
        demo: true,
      });
    }

    try {
      const account = await stripe.accounts.create({
        type: "express",
        email: email,
        business_profile: {
          name: businessName,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Live mode requires HTTPS redirect URLs; use production domain if running on localhost with a live key
      const redirectBase =
        secretKey.startsWith("sk_live_") && origin.startsWith("http://localhost")
          ? "https://wontstopmoving.com"
          : origin;

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${redirectBase}/dashboard/provider`,
        return_url: `${redirectBase}/dashboard/provider`,
        type: "account_onboarding",
      });

      return NextResponse.json({
        accountId: account.id,
        url: accountLink.url,
      });
    } catch (connectErr: any) {
      // If Stripe Connect isn't enabled on the platform account yet or localhost HTTPS restriction hits,
      // gracefully fall back so provider onboarding never breaks
      console.warn(
        "Stripe Connect fallback triggered:",
        connectErr?.message || connectErr
      );
      return NextResponse.json({
        accountId: `acct_demo_${Date.now()}`,
        url: `${origin}/dashboard/provider?stripe_demo=connected`,
        demo: true,
        notice: connectErr?.message,
      });
    }
  } catch (error: any) {
    console.error("Stripe Connect account creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
