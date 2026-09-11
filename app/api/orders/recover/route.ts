import { ORDER_RECOVERY_URL } from '@/lib/server/commerce';
export function GET() {
  return new Response(null, { status: 303, headers: { Location: ORDER_RECOVERY_URL, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
