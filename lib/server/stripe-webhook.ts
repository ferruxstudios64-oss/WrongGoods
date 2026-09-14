
import Stripe from 'stripe';
import { createOrder } from '@/lib/server/orders';
import { setting } from '@/lib/settings';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function processStripeWebhook(sig: string, rawBody: string) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    throw new Error(`Webhook Signature Verification Failed: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return { status: 'ignored' };
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid' || session.mode !== 'payment' || session.livemode) {
    return { status: 'rejected', reason: 'Invalid payment state' };
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const items = lineItems.data;

  if (items.length === 0) {
    throw new Error('No line items found in session');
  }

  const approvedPriceId = setting('STRIPE_DAYSHIFT_PRICE_ID');
  const allItemsMatch = items.every(item => item.price?.id === approvedPriceId);

  if (!allItemsMatch) {
    return { status: 'rejected', reason: 'Wrong product or price detected' };
  }

  const productSlug = session.metadata?.productSlug;
  if (productSlug !== 'dayshift-brand-system') {
    return { status: 'rejected', reason: 'Invalid product slug binding' };
  }

  const checkoutId = session.metadata?.checkoutId;
  if (!checkoutId) {
    throw new Error('Missing checkoutId in session metadata');
  }

  try {
    await createOrder({
      checkoutId,
      productSlug: 'dayshift-brand-system',
      status: 'paid',
    });
    return { status: 'success' };
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      return { status: 'success' };
    }
    throw err;
  }
}
