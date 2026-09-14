import Stripe from 'stripe';
import { setting } from '@/lib/server/env';
import { randomUUID } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createStripeCheckoutSession(product: any) {
  if (product.slug !== 'dayshift-brand-system') {
    throw new Error('Unauthorized product for Stripe checkout');
  }

  const priceId = setting('STRIPE_DAYSHIFT_PRICE_ID');
  const checkoutId = randomUUID();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/checkout/cancel`,
    metadata: {
      checkoutId,
      productSlug: product.slug,
    },
  });

  return { url: session.url, checkoutId };
}
