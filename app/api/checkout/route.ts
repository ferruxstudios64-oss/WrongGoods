import { getPublished } from '@/lib/server/catalog';
import { CommerceError, createCheckout } from '@/lib/server/commerce';

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    if(Number(request.headers.get('content-length'))>2048)return Response.json({error:'Checkout request too large.'},{status:413});
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: 'Checkout request too large.' }, { status: 413 });
    let body;
    try { body = JSON.parse(text); } catch { return Response.json({ error: 'Invalid checkout request.' }, { status: 400 }); }
    if (!body || typeof body.slug !== 'string') return Response.json({ error: 'Choose an available collection.' }, { status: 400 });
    const product = await getPublished(body.slug);
    if (!product || product.status !== 'available') return Response.json({ error: 'This collection is not available for purchase yet.' }, { status: 409 });
    const result = await createCheckout(product, origin,request.headers.get('cf-connecting-ip')||'local');
    return Response.json({ url: result.url, testMode: result.testMode }, { headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof CommerceError ? error.message : 'Checkout is temporarily unavailable. Please try again.' }, { status: error instanceof CommerceError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
