import { database, setting } from './env';
import {throttle,CustomerError} from '../customer';

export const ORDER_RECOVERY_URL = 'https://app.lemonsqueezy.com/my-orders';
const API = 'https://api.lemonsqueezy.com/v1/';
export const STATUS_COOKIE = 'wg_checkout';
export class CommerceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
type ProviderResource = { id: string; type: string; attributes: Record<string, unknown> };
type ProviderResponse = { data: ProviderResource; };
type ProviderList = { data: ProviderResource[]; };
export type CommerceConfig = { apiKey: string; storeId: string; webhookSecret: string; testMode: boolean };
export function commerceConfig(): CommerceConfig {
  const apiKey = setting('LEMONSQUEEZY_API_KEY'), storeId = setting('LEMONSQUEEZY_STORE_ID'), webhookSecret = setting('LEMONSQUEEZY_WEBHOOK_SECRET');
  if (!apiKey || !/^[1-9]\d*$/.test(storeId) || !webhookSecret)
    throw new CommerceError('Checkout is not configured yet. Please try again later.');
  return { apiKey, storeId, webhookSecret, testMode: setting('COMMERCE_LIVE_ENABLED') !== 'true' };
}
async function provider<T>(path: string, config: CommerceConfig, body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${config.apiKey}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new CommerceError('The checkout provider is temporarily unavailable. Please try again.');
  return response.json() as Promise<T>;
}

// The API cannot upload product files. The owner uploads the same ZIP in Lemon Squeezy
// and attests its contents match the private review archive before publication.
export async function verifyProviderVariant(variantId: string, priceGBP: number, expectedArchiveName?: string, config = commerceConfig()) {
  if (!/^[1-9]\d*$/.test(variantId) || !Number.isFinite(priceGBP) || priceGBP <= 0)
    throw new CommerceError('A valid provider variant and price are required.', 409);
  const { data: variant } = await provider<ProviderResponse>(`variants/${variantId}`, config);
  const productId = String(variant.attributes.product_id);
  if (!/^[1-9]\d*$/.test(productId) || String(variant.id) !== variantId || variant.attributes.test_mode !== config.testMode || !['published', 'pending'].includes(String(variant.attributes.status)))
    throw new CommerceError('The provider variant is not ready in the configured payment mode.', 409);
  const results = await Promise.allSettled([
    provider<ProviderResponse>(`products/${productId}`, config),
    provider<ProviderResponse>(`stores/${config.storeId}`, config),
    provider<ProviderList>(`files?filter[variant-id]=${variantId}&page[size]=100`, config),
  ]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const product = (results[0] as PromiseFulfilledResult<ProviderResponse>).value.data;
  const store = (results[1] as PromiseFulfilledResult<ProviderResponse>).value.data;
  const files = (results[2] as PromiseFulfilledResult<ProviderList>).value.data;
  if (String(product.attributes.store_id) !== config.storeId || product.attributes.status !== 'published' || product.attributes.test_mode !== config.testMode || store.attributes.currency !== 'GBP')
    throw new CommerceError('The provider product must be published in the configured GBP store and payment mode.', 409);
  // Variant.price remains the provider's current price; price lists include historical prices.
  if (variant.attributes.price !== Math.round(priceGBP * 100) || variant.attributes.is_subscription !== false || variant.attributes.pay_what_you_want !== false)
    throw new CommerceError('The provider must have the same fixed, one-time GBP price as the storefront.', 409);
  const readyFiles = files.filter(file => String(file.attributes.variant_id) === variantId && file.attributes.status === 'published' && file.attributes.test_mode === config.testMode && Number(file.attributes.size) > 0);
  if (!readyFiles.length || (expectedArchiveName && !readyFiles.some(file => file.attributes.name === expectedArchiveName)))
    throw new CommerceError('Upload and publish the matching downloadable archive in Lemon Squeezy first.', 409);
  return { productId, variantId, testMode: config.testMode, fileIds: readyFiles.map(file => String(file.id)) };
}
export async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function verifySignature(raw: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(raw));
}
export async function createCheckout(product: { slug: string; providerVariantId?: string; priceGBP: number | null }, origin: string, requestKey='local') {
  const config = commerceConfig(), DB = database();
  try{await throttle(DB,`checkout:${requestKey}`,10);}catch(e){if(e instanceof CustomerError)throw new CommerceError(e.message,e.status);throw e;}
  const ready = await verifyProviderVariant(product.providerVariantId || '', product.priceGBP || 0, undefined, config);
  const id = crypto.randomUUID(), token = crypto.randomUUID() + crypto.randomUUID(), now = Date.now();
  // Persist first so an immediate webhook can always find the product binding.
  await DB.prepare('INSERT INTO checkout_sessions (id,token_hash,slug,variant_id,provider_product_id,test_mode,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, await sha256(token), product.slug, ready.variantId, ready.productId, Number(config.testMode), now, now + 2 * 60 * 60 * 1000).run();
  const { data } = await provider<ProviderResponse>('checkouts', config, { data: {
    type: 'checkouts', attributes: {
      test_mode: config.testMode, expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
      product_options: { enabled_variants: [Number(ready.variantId)], redirect_url: `${origin}/order` },
      checkout_options: { embed: false, discount: false }, checkout_data: { custom: { wg_session_id: id } },
    }, relationships: { store: { data: { type: 'stores', id: config.storeId } }, variant: { data: { type: 'variants', id: ready.variantId } } },
  } });
  const url = new URL(String(data.attributes.url));
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.lemonsqueezy.com') || url.username || url.password || data.attributes.test_mode !== config.testMode)
    throw new CommerceError('The checkout provider returned an invalid checkout.');
  return { url: url.href, testMode: config.testMode, cookie: `${STATUS_COOKIE}=${id}.${token}; HttpOnly; SameSite=Lax; Path=/api/orders; Max-Age=7200${origin.startsWith('https:') ? '; Secure' : ''}` };
}

type Session = { id: string; slug: string; variant_id: string; provider_product_id: string; test_mode: number; token_hash: string; expires_at: number };
type OrderEvent = { meta?: { event_name?: string; custom_data?: { wg_session_id?: string } }; data?: { id?: string; type?: string; attributes?: Record<string, unknown> } };
export async function processWebhook(raw: string, signature: string | null) {
  const config = commerceConfig();
  if (!await verifySignature(raw, signature, config.webhookSecret)) throw new CommerceError('Invalid webhook signature.', 401);
  let event: OrderEvent;
  try { event = JSON.parse(raw); } catch { throw new CommerceError('Invalid webhook payload.', 400); }
  const name = event?.meta?.event_name;
  if (!['order_created', 'order_refunded'].includes(name || '')) return { ignored: true };
  const attributes = event.data?.attributes;
  if (!attributes || event.data?.type !== 'orders' || !/^[1-9]\d*$/.test(String(event.data?.id))) throw new CommerceError('Invalid order event.', 400);
  if (String(attributes.store_id) !== config.storeId || attributes.test_mode !== config.testMode) throw new CommerceError('Incorrect store or payment mode.', 400);
  const DB = database(), digest = await sha256(raw);
  if (await DB.prepare('SELECT digest FROM commerce_events WHERE digest=?').bind(digest).first()) return { duplicate: true };
  const sessionId = event.meta?.custom_data?.wg_session_id;
  if (typeof sessionId !== 'string') return { ignored: true }; // Direct provider purchases stay provider-managed.
  const session = await DB.prepare('SELECT * FROM checkout_sessions WHERE id=?').bind(sessionId).first<Session>();
  const item = attributes.first_order_item as Record<string, unknown> | undefined;
  if (!session || !item || String(item.variant_id) !== session.variant_id || String(item.product_id) !== session.provider_product_id || Number(attributes.test_mode) !== session.test_mode)
    throw new CommerceError('The paid product does not match this checkout.', 400);
  const updatedAt = String(attributes.updated_at || '');
  if (!Number.isFinite(Date.parse(updatedAt))) throw new CommerceError('Missing order timestamp.', 400);
  const state = name === 'order_refunded' || ['refunded', 'partial_refund', 'fraudulent'].includes(String(attributes.status)) ? 'refunded' : attributes.status === 'paid' ? 'paid' : attributes.status === 'failed' ? 'failed' : 'pending';
  // D1 batch is transactional. Refund is terminal; late paid events cannot regrant access.
  await DB.batch([
    DB.prepare(`INSERT INTO commerce_orders (id,session_id,slug,variant_id,state,test_mode,updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at
      WHERE commerce_orders.state!='refunded' AND commerce_orders.session_id=excluded.session_id
      AND (excluded.state='refunded' OR excluded.updated_at>=commerce_orders.updated_at)`)
      .bind(String(event.data.id), session.id, session.slug, session.variant_id, state, session.test_mode, new Date(updatedAt).toISOString()),
    DB.prepare('INSERT OR IGNORE INTO commerce_events (digest,order_id,event_name,received_at) VALUES (?,?,?,?)').bind(digest, String(event.data.id), name, Date.now()),
  ]);
  return { received: true };
}
export async function checkoutStatus(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${STATUS_COOKIE}=`))?.slice(STATUS_COOKIE.length + 1);
  if (!cookie || !/^[a-f0-9-]{36}\.[a-f0-9-]{72}$/.test(cookie)) throw new CommerceError('Use your checkout browser or recover your order by email.', 401);
  const [id, token] = cookie.split('.'), DB = database();
  const session = await DB.prepare('SELECT * FROM checkout_sessions WHERE id=?').bind(id).first<Session>();
  if (!session || session.expires_at < Date.now() || session.token_hash !== await sha256(token)) throw new CommerceError('This checkout session has expired. Recover your order by email.', 401);
  const order = await DB.prepare("SELECT state FROM commerce_orders WHERE session_id=? ORDER BY CASE state WHEN 'refunded' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,updated_at DESC LIMIT 1").bind(id).first<{ state: string }>();
  return { state: order?.state || 'pending', testMode: Boolean(session.test_mode), recoveryUrl: ORDER_RECOVERY_URL };
}
