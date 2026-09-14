
import { NextRequest, NextResponse } from 'next/server';
import { processStripeWebhook } from '@/lib/server/stripe-webhook';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.text();
        const signature = req.headers.get('stripe-signature') || '';
        await processStripeWebhook(payload, signature);
        return NextResponse.json({ received: true }, { status: 200 });
    } catch (err: any) {
        console.error('[STRIPE_WEBHOOK_ERROR]', err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

