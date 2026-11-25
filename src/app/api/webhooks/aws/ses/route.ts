import { NextResponse } from 'next/server';
import { confirmSnsSubscription, processSesNotification, readVerifiedSnsRequest, SesFeedbackInputError } from '@/lib/server/ses-feedback';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const message = await readVerifiedSnsRequest(req);
    if (message.Type === 'SubscriptionConfirmation') {
      await confirmSnsSubscription(message);
      return NextResponse.json({ confirmed: true });
    }
    await processSesNotification(message);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof SesFeedbackInputError) return NextResponse.json({ error: 'Invalid email feedback event.' }, { status: 400 });
    return NextResponse.json({ error: 'Email feedback is temporarily unavailable.' }, { status: 503 });
  }
}
