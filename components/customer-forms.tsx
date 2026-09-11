'use client';
import {useState, type FormEvent} from 'react';
import Link from 'next/link';
export function CustomerForm({kind}: {kind: 'signup' | 'contact'}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch(`/api/${kind}`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...Object.fromEntries(data), consent: data.get('consent') === 'on'})});
      const result = await response.json() as {error?: string; message: string};
      if (!response.ok) throw new Error(result.error || 'The request was not saved. Please try again.');
      setMessage(result.message); form.reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="customer-form" onSubmit={submit}>
    {kind === 'contact' && <label>Your name<input name="name" autoComplete="name" maxLength={100} required/></label>}
    <label>Email address<input type="email" name="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required/></label>
    {kind === 'contact' && <label>Your enquiry<textarea name="message" minLength={10} maxLength={5000} rows={6} required/><span className="form-note">Project enquiry, release question or help with an order. Never include payment details.</span></label>}
    <div className="form-trap" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    {kind === 'signup' && <label className="consent"><input type="checkbox" name="consent" required/><span>I agree to receive WrongGoods release emails. I can unsubscribe at any time.</span></label>}
    <p className="form-note">{kind === 'signup' ? 'Release news only. Request removal at tawseen@wronggoods.com. Every release email must include an unsubscribe link.' : 'Your message is stored privately so WrongGoods can respond.'} <Link href="/privacy" className="text-link">Privacy details</Link></p>
    <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : kind === 'signup' ? 'Keep me posted ↗' : 'Send enquiry ↗'}</button>
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
export function LaunchSignup() { return <section className="signup-section" id="updates"><div><span className="eyebrow">RELEASE BULLETIN</span><h2>WHEN THE GOODS<br/>ARE GOOD TO GO.</h2><p>Get an email when a collection is ready. No weekly obligation to say something.</p></div><CustomerForm kind="signup"/></section>; }
