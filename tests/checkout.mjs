import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Test the actual handlers and SQL using SQLite. Provider HTTP is a deterministic
// sandbox fixture; these tests do not claim a real payment or provider delivery.
const dir = mkdtempSync(join(tmpdir(), 'wg-commerce-'));
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
function moduleFile(name, path, replacements = []) {
  let source = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  writeFileSync(join(dir, name + '.mjs'), compile(source));
}
writeFileSync(join(dir, 'env.mjs'), 'export const setting=name=>globalThis.__commerceEnv[name]||""; export const database=()=>globalThis.__commerceDB;');
writeFileSync(join(dir, 'catalog.mjs'), 'export const getPublished=async slug=>globalThis.__commerceProduct?.slug===slug?globalThis.__commerceProduct:null;');
moduleFile('customer','lib/customer.ts');
moduleFile('commerce', 'lib/server/commerce.ts', [["'./env'", "'./env.mjs'"],["'../customer'","'./customer.mjs'"]]);
moduleFile('checkout', 'app/api/checkout/route.ts', [['@/lib/server/catalog', './catalog.mjs'], ['@/lib/server/commerce', './commerce.mjs']]);
moduleFile('webhook', 'app/api/webhooks/lemonsqueezy/route.ts', [['@/lib/server/commerce', './commerce.mjs']]);
moduleFile('status', 'app/api/orders/status/route.ts', [['@/lib/server/commerce', './commerce.mjs']]);
moduleFile('download', 'app/api/downloads/[...path]/route.ts');
moduleFile('recover', 'app/api/orders/recover/route.ts', [['@/lib/server/commerce', './commerce.mjs']]);
const load = name => import(pathToFileURL(join(dir, name + '.mjs')));
const commerce = await load('commerce'), checkout = await load('checkout'), webhook = await load('webhook'), status = await load('status'), download = await load('download'), recover = await load('recover');
const realFetch = globalThis.fetch;
let sql, calls, fixture;
const object = (id, attributes) => ({ data: { id, attributes } });
function statement(query, args = []) {
  return { query, args, bind(...values) { return statement(query, values); },
    async run() { return { meta: sql.prepare(query).run(...args) }; },
    async first() { return sql.prepare(query).get(...args) || null; },
  };
}
beforeEach(() => {
  sql?.close(); sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/0002_commerce.sql', 'utf8'));
  sql.exec(readFileSync('migrations/0002_customer.sql', 'utf8'));
  globalThis.__commerceDB = { prepare: statement, async batch(statements) { sql.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; } catch(error) { sql.exec('ROLLBACK'); throw error; } } };
  globalThis.__commerceEnv = { LEMONSQUEEZY_API_KEY: 'sandbox-fixture', LEMONSQUEEZY_STORE_ID: '5', LEMONSQUEEZY_WEBHOOK_SECRET: 'fixture-signing-secret' };
  globalThis.__commerceProduct = { slug: 'released-fixture', status: 'available', priceGBP: 24, providerVariantId: '10' };
  fixture = {
    variant: { product_id: 20, price: 2400, status: 'published', is_subscription: false, pay_what_you_want: false, test_mode: true },
    product: { store_id: 5, status: 'published', test_mode: true },
    store: { currency: 'GBP' },
    file: { variant_id: 10, name: 'release.zip', size: 1200, status: 'published', test_mode: true },
    checkout: { url: 'https://wronggoods.lemonsqueezy.com/checkout/custom/sandbox', test_mode: true },
  };
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (fixture.fail) return new Response('{}', { status: 502 });
    let data;
    if (url.endsWith('/variants/10')) data = object('10', fixture.variant);
    else if (url.endsWith('/products/20')) data = object('20', fixture.product);
    else if (url.endsWith('/stores/5')) data = object('5', fixture.store);
    else if (url.includes('/files?')) data = { data: fixture.file ? [object('30', fixture.file).data] : [] };
    else if (url.endsWith('/checkouts')) data = object('checkout-fixture', fixture.checkout);
    else throw new Error('Unexpected provider request ' + url);
    return Response.json(data);
  };
});
after(() => { sql.close(); globalThis.fetch = realFetch; rmSync(dir, { recursive: true, force: true }); });
const request = (body, origin = 'https://wronggoods.com') => new Request('https://wronggoods.com/api/checkout', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
async function begin() { const response = await checkout.POST(request({ slug: 'released-fixture' })); assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0]; }
function event(attributes = {}, name = 'order_created') {
  const session = sql.prepare('SELECT * FROM checkout_sessions LIMIT 1').get();
  return JSON.stringify({ meta: { event_name: name, custom_data: { wg_session_id: session.id } }, data: { type: 'orders', id: '90', attributes: { store_id: 5, test_mode: true, status: 'paid', updated_at: '2026-09-11T10:00:00.000Z', first_order_item: { variant_id: 10, product_id: 20 }, ...attributes } } });
}
const sign = raw => createHmac('sha256', 'fixture-signing-secret').update(raw).digest('hex');
const sendEvent = (raw, signature = sign(raw)) => webhook.POST(new Request('https://wronggoods.com/api/webhooks/lemonsqueezy', { method: 'POST', headers: { 'x-signature': signature }, body: raw }));
const getStatus = cookie => status.GET(new Request('https://wronggoods.com/api/orders/status?status=paid&order_id=90', { headers: cookie ? { cookie } : {} }));

test('concepts and absent collections cannot reach payment provider', async () => {
  for (const slug of ['dayshift', 'public-notice', 'false-authority', 'missing']) assert.equal((await checkout.POST(request({ slug }))).status, 409);
  assert.equal(calls.length, 0);
});
test('checkout rejects cross-origin, malformed, null and oversized requests', async () => {
  assert.equal((await checkout.POST(request({}, 'https://evil.example'))).status, 403);
  assert.equal((await checkout.POST(request('{'))).status, 400);
  assert.equal((await checkout.POST(request('null'))).status, 400);
  assert.equal((await checkout.POST(request(' '.repeat(2050)))).status, 413);
});
test('checkout uses verified server product, fixed provider price and test mode', async () => {
  const response = await checkout.POST(request({ slug: 'released-fixture', price: 1, url: 'https://evil.example', variant: '99', testMode: false }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: fixture.checkout.url, testMode: true });
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/api\/orders; Max-Age=7200; Secure/);
  const sent = JSON.parse(calls.find(call => call.url.endsWith('/checkouts')).init.body).data;
  assert.equal(sent.relationships.variant.data.id, '10');
  assert.equal(sent.attributes.test_mode, true);
  assert.deepEqual(sent.attributes.product_options.enabled_variants, [10]);
  assert.equal(sent.attributes.custom_price, undefined);
  assert.equal(sent.attributes.product_options.redirect_url, 'https://wronggoods.com/order');
  assert.ok(sql.prepare('SELECT token_hash FROM checkout_sessions').get().token_hash.length === 64);
});
test('unconfigured or unavailable provider cannot create successful checkout', async () => {
  globalThis.__commerceEnv.LEMONSQUEEZY_API_KEY = '';
  assert.equal((await checkout.POST(request({ slug: 'released-fixture' }))).status, 503);
  globalThis.__commerceEnv.LEMONSQUEEZY_API_KEY = 'sandbox-fixture'; fixture.fail = true;
  assert.equal((await checkout.POST(request({ slug: 'released-fixture' }))).status, 503);
});
test('release verification rejects wrong mode, price, currency, product, missing/draft/wrong files', async () => {
  await commerce.verifyProviderVariant('10', 24, 'release.zip');
  const mutate = async (obj, field, value) => { const previous = obj[field]; obj[field] = value; await assert.rejects(commerce.verifyProviderVariant('10', 24, 'release.zip')); obj[field] = previous; };
  await mutate(fixture.variant, 'test_mode', false);
  await mutate(fixture.variant, 'price', 1200);
  await mutate(fixture.variant, 'is_subscription', true);
  await mutate(fixture.product, 'store_id', 6);
  await mutate(fixture.product, 'status', 'draft');
  await mutate(fixture.store, 'currency', 'USD');
  await mutate(fixture.file, 'variant_id', 99);
  await mutate(fixture.file, 'status', 'draft');
  await mutate(fixture.file, 'name', 'other.zip');
  fixture.file = null;
  await assert.rejects(commerce.verifyProviderVariant('10', 24));
});
test('provider cannot redirect the customer to an untrusted host or unexpected live checkout', async () => {
  fixture.checkout.url = 'https://lemonsqueezy.com.evil.example/checkout';
  assert.equal((await checkout.POST(request({ slug: 'released-fixture' }))).status, 503);
  fixture.checkout.url = 'https://wronggoods.lemonsqueezy.com/checkout'; fixture.checkout.test_mode = false;
  assert.equal((await checkout.POST(request({ slug: 'released-fixture' }))).status, 503);
});
test('unsigned, malformed and body-tampered webhooks never confirm payment', async () => {
  const cookie = await begin(), raw = event();
  assert.equal((await sendEvent(raw, '')).status, 401);
  assert.equal((await sendEvent(raw, 'bad')).status, 401);
  assert.equal((await sendEvent(raw + ' ', sign(raw))).status, 401);
  assert.equal((await sendEvent('{')).status, 400);
  assert.equal((await (await getStatus(cookie)).json()).state, 'pending');
});
test('signed paid event binds correct product and is idempotent across replay', async () => {
  const cookie = await begin(), raw = event();
  assert.equal((await sendEvent(raw)).status, 200);
  assert.equal((await (await getStatus(cookie)).json()).state, 'paid');
  assert.deepEqual(await (await sendEvent(raw)).json(), { duplicate: true });
  assert.equal(sql.prepare('SELECT count(*) AS n FROM commerce_orders').get().n, 1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM commerce_events').get().n, 1);
  assert.equal(sql.prepare('SELECT variant_id FROM commerce_orders').get().variant_id, '10');
});
test('signed wrong product, wrong store or wrong mode cannot bind an order', async () => {
  const cookie = await begin();
  for (const attrs of [{ first_order_item: { variant_id: 11, product_id: 20 } }, { first_order_item: { variant_id: 10, product_id: 21 } }, { store_id: 9 }, { test_mode: false }]) assert.equal((await sendEvent(event(attrs))).status, 400);
  assert.equal((await (await getStatus(cookie)).json()).state, 'pending');
});
test('failure is truthful and refund is terminal despite delayed or replayed paid events', async () => {
  const cookie = await begin();
  await sendEvent(event({ status: 'failed' }));
  assert.equal((await (await getStatus(cookie)).json()).state, 'failed');
  await sendEvent(event({ updated_at: '2026-09-11T10:01:00Z' }));
  assert.equal((await (await getStatus(cookie)).json()).state, 'paid');
  await sendEvent(event({ status: 'refunded', updated_at: '2026-09-11T10:02:00Z' }, 'order_refunded'));
  await sendEvent(event({ updated_at: '2026-09-11T10:03:00Z' }));
  assert.equal((await (await getStatus(cookie)).json()).state, 'refunded');
});
test('browser return parameters, guessed order numbers and expired cookies cannot authenticate', async () => {
  const cookie = await begin();
  assert.equal((await getStatus()).status, 401);
  assert.equal((await getStatus(cookie.slice(0, -1) + 'z')).status, 401);
  assert.equal((await (await getStatus(cookie)).json()).state, 'pending');
  sql.exec('UPDATE checkout_sessions SET expires_at=0');
  assert.equal((await getStatus(cookie)).status, 401);
});
test('private archives are denied even with order query; recovery is fixed provider email login', async () => {
  assert.equal(download.GET(new Request('https://wronggoods.com/api/downloads/release.zip?paid=true')).status, 401);
  const response = recover.GET();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://app.lemonsqueezy.com/my-orders');
});
