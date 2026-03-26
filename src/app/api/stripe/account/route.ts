import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { email, businessName } = await req.json();

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

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9002";

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/dashboard/provider`,
      return_url: `${origin}/dashboard/provider`,
      type: "account_onboarding",
    });

    return NextResponse.json({ 
      accountId: account.id, 
      url: accountLink.url 
    });
  } catch (error: any) {
    console.error("Stripe Connect account creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
