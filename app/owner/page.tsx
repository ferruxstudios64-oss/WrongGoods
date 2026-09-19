'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {OwnerStudio} from '@/components/owner-studio';
import './owner.css';

export default function OwnerPage(){
  const [checking,setChecking]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/owner/products',{credentials:'same-origin',cache:'no-store'})
      .then(response=>setSignedIn(response.ok))
      .catch(()=>setSignedIn(false))
      .finally(()=>setChecking(false));
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    setBusy(true);setMessage('');setError('');
    try{
      const response=await fetch('/api/owner/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email')})});
      const result=await response.json() as {message?:string;error?:string};
      if(!response.ok)throw new Error(result.error||'Could not send the sign-in link.');
      setMessage(result.message||'Check your email for the private sign-in link.');
      form.reset();
    }catch(error){
      setError(error instanceof Error?error.message:'Could not send the sign-in link.');
    }finally{setBusy(false);}
  }

  if(checking)return <main id="main" className="owner-studio"><section className="owner-gate"><span className="eyebrow">WRONGGOODS / ADMIN ACCESS</span><h2>Checking access...</h2></section></main>;
  if(signedIn)return <OwnerStudio/>;

  return <main id="main" className="owner-studio">
    <div className="owner-heading"><div><span className="eyebrow">WRONGGOODS / ADMIN ACCESS</span><h1>PRIVATE ENTRY.</h1><p>The storefront stays closed to the public until the first release is ready.</p></div></div>
    <section className="owner-gate">
      <span className="eyebrow">PASSWORDLESS ACCESS</span>
      <h2>Admin sign-in.</h2>
      <form className="owner-login" onSubmit={submit}>
        <p>Enter your approved admin email. A one-use sign-in link will be sent to you.</p>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
        {message&&<p className="owner-note" role="status">{message}</p>}
        {error&&<p className="owner-error" role="alert">{error}</p>}
        <button className="button" disabled={busy}>{busy?'Sending link...':'Email sign-in link'}</button>
        <p className="owner-hint">No public registration. Links expire after 15 minutes.</p>
      </form>
    </section>
  </main>;
}
