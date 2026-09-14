
import Stripe from 'stripe';
import { database, setting } from '@/lib/server/env';
import { sha256 } from '@/lib/server/commerce';

const stripe = new Stripe(setting('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-08-26.dahlia',
});

export async function processStripeWebhook(raw: string, signature: string | null) {
    const secret = setting('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('Stripe webhook secret not configured');

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(raw, signature!, secret);
    } catch (err: any) {
        throw new Error(`Stripe signature verification failed: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.client_reference_id;

        if (!sessionId) throw new Error('Missing client_reference_id in Stripe session');

        const DB = database();
        const digest = await sha256(raw);

        if (await DB.prepare('SELECT digest FROM commerce_events WHERE digest=?').bind(digest).first()) {
            return { duplicate: true };
        }

        const stored = await DB.prepare('SELECT * FROM checkout_sessions WHERE id=?').bind(sessionId).first<{
            id: string; slug: string; variant_id: string; provider_product_id: string; test_mode: number;
        }>();

        if (!stored) throw new Error('Unpersisted WG session. Entitlement rejected.');

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const item = lineItems.data[0];
        if (!item) throw new Error('No line items found in session');
        
        const priceId = item.price?.id;
        const productId = item.price?.product as string;

        if (!priceId || priceId !== stored.variant_id || !productId || productId !== stored.provider_product_id) {
            throw new Error('Stripe Price/Product mismatch with persisted session.');
        }

        if (session.payment_status !== 'paid' || session.mode !== 'payment' || session.livemode !== false) {
            throw new Error('Invalid payment status or mode. Entitlement rejected.');
        }

        const updatedAt = new Date().toISOString();
        await DB.batch([
            DB.prepare(`INSERT INTO commerce_orders (id, session_id, slug, variant_id, state, test_mode, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at
              WHERE commerce_orders.state != 'refunded' AND commerce_orders.session_id = excluded.session_id
              AND (excluded.state = 'refunded' OR excluded.updated_at >= commerce_orders.updated_at)`)
              .bind(session.id, stored.id, stored.slug, stored.variant_id, 'paid', stored.test_mode, updatedAt),
            DB.prepare('INSERT OR IGNORE INTO commerce_events (digest, order_id, event_name, received_at) VALUES (?, ?, ?, ?)')
              .bind(digest, session.id, 'payment_completed', Date.now()),
        ]);
    }

    return { received: true };
}

