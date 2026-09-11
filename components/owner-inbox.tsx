'use client';
import { useEffect, useState } from 'react';
type Inbox = { messages: { id: string; name: string; email: string; message: string; created_at: string }[]; signups: { email: string; created_at: string; consent_text: string }[] };
export function OwnerInbox() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function load() {
    return fetch('/api/owner/inbox', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {const data=await response.json() as Inbox & {error?:string}; if(!response.ok)throw new Error(data.error||'The inbox could not be loaded.');return data;})
      .then(data => {setInbox(data);setError('');})
      .catch(e => setError((e as Error).message)).finally(()=>setBusy(false));
  }
  useEffect(() => { void load(); }, []);
  async function unsubscribe(email: string) {
    if (!window.confirm(`Unsubscribe ${email} from launch updates?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/owner/inbox', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'The subscription could not be removed.'); }
      setInbox(current => current && { ...current, signups: current.signups.filter(s => s.email !== email) });
      setNotice(`${email} has been unsubscribed.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main id="main" className="owner-studio"><a className="text-link" href="/owner">← Owner studio</a><div className="owner-heading"><div><span className="eyebrow">WRONGGOODS / PRIVATE CORRESPONDENCE</span><h1>INCOMING.</h1><p>Customer enquiries and people waiting for the first release.</p></div><button className="owner-secondary" disabled={busy} onClick={() => void load()}>{busy ? 'Loading…' : 'Refresh inbox'}</button></div><div className="owner-feedback" aria-live="polite">{error && <p role="alert" className="owner-error">{error}</p>}{notice && <p role="status">{notice}</p>}</div>{inbox ? <div className="owner-inbox-grid"><section><h2>Messages <span className="owner-state">{inbox.messages.length}</span></h2>{!inbox.messages.length && <p className="owner-note">No messages yet.</p>}{inbox.messages.map(message => <article className="owner-message" key={message.id}><h3>{message.name}</h3><a className="text-link" href={`mailto:${encodeURIComponent(message.email)}`}>{message.email}</a><p className="owner-state">Received {message.created_at}</p><p className="owner-message-body">{message.message}</p><a className="owner-secondary" href={`mailto:${encodeURIComponent(message.email)}?subject=WrongGoods%20enquiry`}>Reply by email ↗</a></article>)}</section><section><h2>Launch subscribers <span className="owner-state">{inbox.signups.length}</span></h2><p className="owner-hint">Only contact subscribers for the updates they consented to receive. This page does not send mail.</p>{!inbox.signups.length && <p className="owner-note">No active subscribers yet.</p>}{inbox.signups.map(signup => <article className="owner-message" key={signup.email}><h3>{signup.email}</h3><p className="owner-state">Joined {signup.created_at}</p><p className="owner-hint">Consent: {signup.consent_text}</p><button className="owner-secondary" disabled={busy} onClick={() => void unsubscribe(signup.email)}>Unsubscribe</button></article>)}</section></div> : !busy && <section className="owner-gate"><h2>Owner access required.</h2><p>Sign in to the owner studio to read customer messages and subscriber details.</p><a className="text-link" href="/owner">Return to owner sign-in</a></section>}</main>;
}
