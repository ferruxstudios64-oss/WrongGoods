import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession } from '@/lib/server/stripe';
import { getPublished } from '@/lib/server/catalog';
import { setting } from '@/lib/server/env';

export async function POST(req: NextRequest) {
  if (process.env.STRIPE_SANDBOX_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Stripe sandbox is currently disabled' }, { status: 403 });
  }

  const canonicalOrigin = new URL(req.url).origin;
  const originHeader = req.headers.get('origin');
  if (!originHeader || originHeader !== canonicalOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  try {
    const bodyText = await req.text();
    if (bodyText.length > 2048) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    const { slug } = JSON.parse(bodyText);

    const product = await getPublished(slug);
    if (!product) {
      return NextResponse.json({ error: 'Product not available' }, { status: 404 });
    }

    const session = await createStripeCheckoutSession(product);
    
    const response = NextResponse.json({ url: session.url });
    response.cookies.set('wg_checkout', session.checkoutId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
