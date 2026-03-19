import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';

/**
 * Stripe Webhook Handler
 * This endpoint processes successful payments and automates Job creation.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature') as string;

  let event;

  try {
    // Verify the webhook is actually from Stripe
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the successful payment event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const metadata = session.metadata;

    if (!metadata?.quoteId || !metadata?.customerId) {
      console.error('Webhook Error: Missing metadata in session');
      return new NextResponse('Missing Metadata', { status: 400 });
    }

    const { quoteId, customerId, moveSize } = metadata;
    const { firestore } = initializeFirebase();

    try {
      // 1. Update the Quote status to "processed"
      const quoteRef = doc(firestore, 'quotes', quoteId);
      const quoteSnap = await getDoc(quoteRef);
      
      if (!quoteSnap.exists()) {
        console.error(`Quote ${quoteId} not found`);
        return new NextResponse('Quote not found', { status: 404 });
      }

      const quoteData = quoteSnap.data();
      let details: any = {};
      try {
        details = typeof quoteData.details === 'string' ? JSON.parse(quoteData.details) : quoteData.details;
      } catch (e) {
        console.warn('Could not parse quote details JSON');
      }

      await updateDoc(quoteRef, { status: 'processed' });

      // 2. Create the official Job entity for the dispatch board
      const jobsCollection = collection(firestore, 'jobs');
      const newJobRef = doc(jobsCollection);
      
      const jobData = {
        id: newJobRef.id,
        customerId: customerId,
        quoteId: quoteId,
        status: 'scheduled',
        state: quoteData.state || details.state || 'TX', // Defaulting to TX if not found
        moveDate: quoteData.moveDate || details.moveDate || '',
        pickupAddress: quoteData.pickupAddress || details.pickupZip || '',
        dropoffAddress: quoteData.dropoffAddress || details.dropoffZip || '',
        moveSize: moveSize || quoteData.moveSize || 'studio',
        price: session.amount_total / 100, // Convert from cents to dollars
        employeeIds: [], // Initially unassigned
        specialItems: quoteData.specialItems || details.specialItems || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentId: session.id,
        customerEmail: session.customer_details?.email || quoteData.email || ''
      };

      await setDoc(newJobRef, jobData);

      console.log(`Successfully created Job ${newJobRef.id} from Quote ${quoteId}`);
    } catch (dbError: any) {
      console.error('Database Error in Webhook:', dbError);
      return new NextResponse('Database error', { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
