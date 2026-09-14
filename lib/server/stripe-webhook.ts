
import Stripe from 'stripe';
import { database, setting } from '@/lib/server/env';
import { getPublished } from '@/lib/server/catalog';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-08-26.dahlia',
});

export async function processStripeWebhook(payload: string, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err: any) {
        throw new Error(`Webhook Signature Verification Failed: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const variantId = session.metadata?.variant_id;
        if (!variantId) throw new Error('Missing variant_id in session metadata');

        const product = await getPublished(variantId);
        if (!product) throw new Error('Product not found or not published');

        const { data: existingOrder } = await database()
            .prepare('SELECT * FROM commerce_orders WHERE stripe_session_id = ?')
            .bind(session.id)
            .all();

        if (existingOrder.length > 0) return { status: 'already_processed' };

        // Using the repository's batch interface
        await database().batch([
            database().prepare('INSERT INTO commerce_orders (stripe_session_id, variant_id, amount, currency, customer_email, status, test_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(session.id, variantId, session.amount_total! / 100, session.currency || 'gbp', session.customer_details?.email, 'paid', 1, new Date().toISOString()),
            database().prepare('INSERT INTO commerce_events (order_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)')
                .bind(session.id, 'payment_completed', JSON.stringify(session), new Date().toISOString()),
        ]);
    }

    return { status: 'success' };
}

