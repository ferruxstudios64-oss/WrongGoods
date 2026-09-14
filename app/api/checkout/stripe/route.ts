
import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession } from '@/lib/server/stripe';
import { setting } from '@/lib/server/env';

export async function POST(req: NextRequest) {
    try {
        if (!setting('STRIPE_SANDBOX_ENABLED')) {
            return NextResponse.json({ error: 'Commerce is disabled' }, { status: 403 });
        }

        const { variantId } = await req.json();
        const session = await createStripeCheckoutSession(variantId);

        const response = NextResponse.redirect(session.url);
        response.cookies.set('wg_checkout', session.id, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
        });

        return response;
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

