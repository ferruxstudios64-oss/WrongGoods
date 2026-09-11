import { CommerceError, processWebhook } from '@/lib/server/commerce';
export async function POST(request: Request) {
  try {
    if(Number(request.headers.get('content-length'))>256000)return Response.json({error:'Payload too large.'},{status:413});
    const raw = await request.text();
    if (raw.length > 256000) return Response.json({ error: 'Payload too large.' }, { status: 413 });
    return Response.json(await processWebhook(raw, request.headers.get('x-signature')));
  } catch (error) {
    return Response.json({ error: error instanceof CommerceError ? error.message : 'Webhook processing failed. Please retry.' }, { status: error instanceof CommerceError ? error.status : 503 });
  }
}
