import Stripe from 'stripe';
import { database, setting } from '@/lib/server/env';

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

  const DB = database();
  const now = new Date().toISOString();
  
  const { sha256 } = await import('@/lib/server/commerce');
  const digest = await sha256(rawBody);

  if (await DB.prepare('SELECT digest FROM commerce_events WHERE digest=?').bind(digest).first()) {
    return { status: 'success', duplicate: true };
  }

  try {
    await DB.batch([
      DB.prepare(`INSERT INTO commerce_orders (id,session_id,slug,variant_id,state,test_mode,updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at
        WHERE commerce_orders.state!='refunded' AND commerce_orders.session_id=excluded.session_id
        AND (excluded.state='refunded' OR excluded.updated_at>=commerce_orders.updated_at)`)
        .bind(String(session.id), checkoutId, productSlug, 'stripe_id', 'paid', 0, now),
      DB.prepare('INSERT OR IGNORE INTO commerce_events (digest,order_id,event_name,received_at) VALUES (?,?,?,?)')
        .bind(digest, String(session.id), 'checkout.session.completed', Date.now()),
    ]);
    return { status: 'success' };
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      return { status: 'success' };
    }
    throw err;
  }
}
