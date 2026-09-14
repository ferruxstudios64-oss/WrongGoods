
import { database, setting } from './env';
import { throttle, CustomerError } from '../customer';

export class StripeCommerceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  dayshiftPriceId: string;
};

export function stripeConfig(): StripeConfig {
  const secretKey = setting('STRIPE_SECRET_KEY');
  const webhookSecret = setting('STRIPE_WEBHOOK_SECRET');
  const dayshiftPriceId = setting('STRIPE_DAYSHIFT_PRICE_ID');

  if (!secretKey || !webhookSecret || !dayshiftPriceId) {
    throw new StripeCommerceError('Stripe sandbox is not configured yet.');
  }
  return { secretKey, webhookSecret, dayshiftPriceId };
}

export async function createStripeCheckoutSession(slug: string, origin: string, requestKey = 'local') {
  const config = stripeConfig();
  const DB = database();

  try {
    await throttle(DB, `stripe-checkout:${requestKey}`, 10);
  } catch (e) {
    if (e instanceof CustomerError) throw new StripeCommerceError(e.message, e.status);
    throw e;
  }

  const sessionId = crypto.randomUUID();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = Date.now();

  await DB.prepare(
    'INSERT INTO checkout_sessions (id, token_hash, slug, variant_id, provider_product_id, test_mode, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(
    sessionId,
    await sha256(token),
    slug,
    config.dayshiftPriceId,
    'prod_VFz55EpwRG13aX',
    1,
    now,
    now + 2 * 60 * 60 * 1000
  ).run();

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price]': config.dayshiftPriceId,
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': `${origin}/order?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/order?status=cancelled`,
      'client_reference_id': sessionId,
    }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { error?: { message?: string } };
    throw new StripeCommerceError(err.error?.message || 'Stripe session creation failed.');
  }

  const data = (await response.json()) as { url: string };
  
  return {
    url: data.url,
    testMode: true,
    cookie: `wg_checkout=${sessionId}.${token}; HttpOnly; SameSite=Lax; Path=/api/orders; Max-Age=7200${origin.startsWith('https:') ? '; Secure' : ''}`
  };
}

export async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
