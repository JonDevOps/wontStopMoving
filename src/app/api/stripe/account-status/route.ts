import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();
    if (!accountId) throw new Error("Missing accountId");

    const account = await stripe.accounts.retrieve(accountId);

    return NextResponse.json({ 
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });
  } catch (error: any) {
    console.error("Stripe accountStatus error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
