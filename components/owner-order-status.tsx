'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Order = { state: 'pending' | 'failed' | 'paid' | 'refunded'; testMode: boolean };
type View = Order | { state: 'checking' | 'unavailable' | 'recovery' | 'cancelled'; testMode?: boolean };
const copy = {
  checking: ['CHECKING YOUR ORDER.', 'Waiting for a verified payment update from checkout.'],
  pending: ['CONFIRMATION PENDING.', 'Checkout has not yet confirmed payment. Please wait before trying another purchase.'],
  failed: ['PAYMENT NOT COMPLETED.', 'The payment provider reported that this payment failed. Return to the collection to try again, or contact us if you need help.'],
  paid: ['THE GOODS ARE YOURS.', 'Payment is confirmed. Open your orders with Lemon Squeezy to access the files for this purchase. Your receipt also contains your download link.'],
  refunded: ['ORDER REFUNDED.', 'The payment provider has confirmed a refund for this order. Contact us if you have a question about it.'],
  recovery: ['FIND YOUR GOODS.', 'This browser does not have an active checkout reference. Use the email address you paid with to recover your orders securely.'],
  cancelled: ['CHECKOUT CLOSED.', 'No completed payment is confirmed here. Check your orders before starting a new purchase if you are unsure whether payment went through.'],
  unavailable: ['WE CANNOT CHECK JUST YET.', 'The order service is currently unavailable. Your payment status has not been confirmed here. Check your receipt or recover your order with the payment provider.'],
} as const;
export function OrderStatus() {
  const [view, setView] = useState<View>({ state: 'checking' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const cancelled = new URLSearchParams(window.location.search).get('status') === 'cancelled';
    async function check() {
      try {
        const response = await fetch('/api/orders/status', { credentials: 'same-origin', cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) { setView({ state: cancelled ? 'cancelled' : 'recovery' }); return; }
        if (!response.ok) { setView({ state: 'unavailable' }); return; }
        const data = await response.json() as Order;
        if (!active) return;
        if (!['pending', 'failed', 'paid', 'refunded'].includes(data.state)) { setView({ state: 'unavailable' }); return; }
        setView(cancelled && data.state === 'pending' ? {state:'cancelled', testMode:data.testMode} : data);
        if (data.state === 'pending' && ++polls < 12) timer = setTimeout(() => void check(), 5000);
      } catch { if (active) setView({ state: 'unavailable' }); }
    }
    void check();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [attempt]);
  const [heading, description] = copy[view.state];
  return <main id="main" className="order-page"><span className="eyebrow">WRONGGOODS / ORDER DESK</span><div className="order-state" role="status" aria-live="polite"><span className="order-marker" aria-hidden="true">{view.state === 'paid' ? '✓' : '↗'}</span><h1>{heading}</h1>{view.testMode && <p className="order-test">TEST ORDER — no live purchase</p>}<p className="order-description">{description}</p></div><div className="order-actions"><a className="button" href="/api/orders/recover">{view.state === 'paid' ? 'Get your downloads ↗' : 'Recover an order ↗'}</a>{['pending', 'unavailable', 'cancelled'].includes(view.state) && <button className="order-secondary" onClick={() => { setView({ state: 'checking' }); setAttempt(attempt + 1); }}>Check payment status</button>}<Link className="text-link" href="/#goods">Back to the goods</Link></div><section className="order-help"><h2>Need a hand?</h2><p>Order recovery opens Lemon Squeezy. Enter the email you used at checkout to receive a secure sign-in link.</p><p>For a missing file or a product question, email <a className="text-link" href="mailto:tawseen@wronggoods.com?subject=WrongGoods%20order%20help">tawseen@wronggoods.com</a> with your order number. Never send payment card details.</p></section></main>;
}
