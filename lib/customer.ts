export type CustomerDatabase = Pick<D1Database, 'prepare' | 'batch'>;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export class CustomerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function readCustomerRequest(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new CustomerError('Invalid request origin.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new CustomerError('Use a JSON request.', 415);
  if (Number(request.headers.get('content-length')) > 12000) throw new CustomerError('Your message is too long.', 413);
  const text = await request.text();
  if (text.length > 12000) throw new CustomerError('Your message is too long.', 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { throw new CustomerError('The request could not be read. Please try again.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomerError('Invalid request.');
  if (body.website) throw new CustomerError('The request could not be accepted.');
  return body;
}
function email(value: unknown) {
  if (typeof value !== 'string' || value.trim().length > 254 || !emailPattern.test(value.trim())) throw new CustomerError('Enter a valid email address.');
  return value.trim().toLowerCase();
}
// Atomic counters persist across Worker instances. Addresses are hashed and never stored here.
export async function throttle(db: CustomerDatabase, key: string, limit = 10) {
  const window = Math.floor(Date.now() / 3600000);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}:${window}`));
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const row = await db.prepare('INSERT INTO request_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(hash, window).first<{count: number}>();
  if (!row || row.count > limit) throw new CustomerError('Too many requests. Please try again in an hour.', 429);
  await db.prepare('DELETE FROM request_limits WHERE window < ?').bind(window - 24).run();
}
export async function saveSignup(db: CustomerDatabase, body: Record<string, unknown>) {
  const address = email(body.email);
  if (body.consent !== true) throw new CustomerError('Please agree to receive WrongGoods release emails.');
  const result = await db.prepare('INSERT INTO launch_signups (email, consent_text, consent_version, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(address, 'I agree to receive WrongGoods release emails. I can unsubscribe at any time.', '2026-09-11', new Date().toISOString()).run();
  if (!result.success) throw new CustomerError('Your signup was not saved. Please try again.', 503);
  return { message: 'Your release-email request is saved. If this address was already on the list, it remains subscribed.' };
}
export async function saveContact(db: CustomerDatabase, body: Record<string, unknown>) {
  const address = email(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!name || name.length > 100) throw new CustomerError('Enter your name (up to 100 characters).');
  if (message.length < 10 || message.length > 5000) throw new CustomerError('Write a message between 10 and 5,000 characters.');
  const result = await db.prepare('INSERT INTO contact_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), name, address, message, new Date().toISOString()).run();
  if (!result.success) throw new CustomerError('Your enquiry was not saved. Please try again or email us.', 503);
  return { message: 'Your enquiry is saved in the WrongGoods inbox. We can reply to the email address you supplied.' };
}
