
import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession } from '@/lib/server/stripe';
import { setting } from '@/lib/server/env';
import { getPublished } from '@/lib/server/catalog';

export async function POST(req: NextRequest) {
    try {
        if (!setting('STRIPE_SANDBOX_ENABLED')) {
            return NextResponse.json({ error: 'Commerce is disabled' }, { status: 403 });
        }

        const body = await req.json() as { variantId?: string };
        const variantId = body?.variantId;
        if (!variantId) {
            return NextResponse.json({ error: 'Missing variantId' }, { status: 400 });
        }

        const product = await getPublished(variantId);
        if (!product) {
            return NextResponse.json({ error: 'Product not found or not published' }, { status: 404 });
        }

        const origin = req.url || 'https://wronggoods.com';
        const { url, id, token } = await createStripeCheckoutSession(
            { slug: product.slug, providerVariantId: variantId, priceGBP: (product as any).price || 0 }, 
            origin
        );

        const response = NextResponse.redirect(url);
        response.cookies.set('wg_checkout', `${id}.${token}`, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/api/orders',
            maxAge: 7200,
        });

        return response;
    } catch (err: any) {
        console.error('[STRIPE_CHECKOUT_ERROR]', err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

