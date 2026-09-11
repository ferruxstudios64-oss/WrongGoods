import { checkoutStatus, CommerceError } from '@/lib/server/commerce';
export async function GET(request: Request) {
  try { return Response.json(await checkoutStatus(request), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof CommerceError ? error.message : 'Order status is temporarily unavailable.' }, { status: error instanceof CommerceError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } }); }
}
