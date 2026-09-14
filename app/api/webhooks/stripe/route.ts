
import { NextRequest, NextResponse } from 'next/server';
import { processStripeWebhook } from '@/lib/server/stripe-webhook';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    const result = await processStripeWebhook(rawBody, signature);
    
    if (result?.duplicate) return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    if (result?.ignored) return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    console.error('[STRIPE WEBHOOK ERROR]:', e.message);
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
