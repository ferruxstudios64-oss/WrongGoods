
import { NextRequest, NextResponse } from 'next/server';
import { createStripeCheckoutSession, StripeCommerceError } from '@/lib/server/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { slug?: string };
    const slug = body.slug;
    if (!slug) return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    
    const origin = req.headers.get('origin') || 'https://wronggoods.com';
    const result = await createStripeCheckoutSession(slug, origin);
    
    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof StripeCommerceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[STRIPE CHECKOUT ERROR]:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
