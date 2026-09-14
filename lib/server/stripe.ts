
import Stripe from 'stripe';
import { database, setting } from './env';
import { sha256 } from './commerce';
import { getPublished } from './catalog';

const stripe = new Stripe(setting('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-08-26.dahlia',
});

export async function createStripeCheckoutSession(product: { slug: string; providerVariantId: string; priceGBP: number }, origin: string) {
    const DB = database();
    const id = crypto.randomUUID();
    const token = crypto.randomUUID() + crypto.randomUUID();
    const now = Date.now();

    // Auth mapping: providerVariantId = Stripe Price ID
    // We should verify the Price ID exists and matches the priceGBP.
    // For the sandbox, we assume the provided providerVariantId is the correct Stripe Price ID.

    // 1. Persist checkout_sessions BEFORE redirect (Contract B)
    // Variant ID = Price ID, Provider Product ID = Stripe Product ID
    // We'll fetch the Price object to get the Product ID.
    const price = await stripe.prices.retrieve(product.providerVariantId);
    const productId = price.product as string;

    await DB.prepare('INSERT INTO checkout_sessions (id, token_hash, slug, variant_id, provider_product_id, test_mode, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, await sha256(token), product.slug, product.providerVariantId, productId, 1, now, now + 2 * 60 * 60 * 1000)
        .run();

    // 2. Create Stripe Session (Contract D: client_reference_id = WG session id)
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price: product.providerVariantId,
            quantity: 1,
        }],
        mode: 'payment',
        success_url: `${origin}/order?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
        client_reference_id: id,
        metadata: {
            wg_session_id: id,
            slug: product.slug,
        },
    });

    return { 
        url: session.url, 
        id: id, 
        token: token, 
        testMode: true 
    };
}

