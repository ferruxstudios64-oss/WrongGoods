'use client';
import {useState,type FormEvent} from 'react';
export function OwnerLogin({onSignedIn}:{onSignedIn:()=>void}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setError('');
    try{const response=await fetch('/api/owner/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Sign-in failed.');form.reset();onSignedIn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="owner-login"><p>Sign in with your approved owner email and Supabase password.</p><label>Email<input type="email" name="email" autoComplete="username" required maxLength={254}/></label><label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={256}/></label>{error&&<p role="alert" className="owner-error">{error}</p>}<button className="button" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="owner-hint">First visit or forgotten password? Your project administrator can set up or reset your account in Supabase → Authentication → Users.</p></form>;
}
export function OwnerLogout(){const [error,setError]=useState('');return <><button className="text-link" onClick={async()=>{try{const response=await fetch('/api/owner/session',{method:'DELETE'});if(!response.ok)throw Error('Sign-out could not be completed. Please retry.');window.location.assign('/owner');}catch(e){setError((e as Error).message);}}}>Sign out</button>{error&&<p role="alert">{error}</p>}</>;}
