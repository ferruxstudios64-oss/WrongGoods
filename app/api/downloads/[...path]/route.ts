// Downloads are authenticated by Lemon Squeezy's My Orders magic-link login.
// No local URL, checkout return parameter or order number exposes private R2 archives.
export function GET() {
  return Response.json({ error: 'Recover your secure downloads through My Orders.', recoveryUrl: '/api/orders/recover' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
