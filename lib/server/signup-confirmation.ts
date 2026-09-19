import {setting,database} from './env';
import {CustomerError,throttle} from '../customer';

const segmentId='e812ada8-5c77-49bd-ba93-5a4135a87345';
export const signupSuccess='You’re on the release list. Check your inbox for confirmation.';
export const savedButEmailFailed='Your signup is saved and you remain on the release list, but we could not send the confirmation email. Please try again later.';

async function resend(path:string,init:RequestInit={}){
  const apiKey=setting('RESEND_API_KEY');
  if(!apiKey)throw new Error('Resend is not configured.');
  return fetch(`https://api.resend.com${path}`,{
    ...init,
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...init.headers},
  });
}

async function responseText(response:Response){try{return await response.text();}catch{return '';}}

async function syncResendContact(address:string){
  const create=await resend('/contacts',{method:'POST',body:JSON.stringify({email:address,unsubscribed:false,segments:[{id:segmentId}]})});
  if(create.ok)return;
  const detail=await responseText(create);
  const conflict=create.status===409||(create.status===422&&/already|exist/i.test(detail));
  if(!conflict)throw new Error(`Resend contact sync failed (${create.status}).`);
  const contact=encodeURIComponent(address);
  const update=await resend(`/contacts/${contact}`,{method:'PATCH',body:JSON.stringify({unsubscribed:false})});
  if(!update.ok)throw new Error(`Resend contact update failed (${update.status}).`);
  const addToSegment=await resend(`/contacts/${contact}/segments/${segmentId}`,{method:'POST'});
  if(!addToSegment.ok&&addToSegment.status!==409)throw new Error(`Resend segment sync failed (${addToSegment.status}).`);
}

async function confirmationKey(address:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(address));
  return `signup-confirmation-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}

async function sendConfirmation(address:string){
  const response=await resend('/emails',{
    method:'POST',
    headers:{'Idempotency-Key':await confirmationKey(address)},
    body:JSON.stringify({template:{id:'signup-confirmation'},to:[address]}),
  });
  if(!response.ok)throw new Error(`Resend confirmation failed (${response.status}).`);
}

export async function confirmSignup(address:string,requestKey:string){
  let allowed=true;
  try{
    await throttle(database(),`signup-confirmation:${requestKey}:${address}`,1);
  }catch(error){
    if(error instanceof CustomerError&&error.status===429)allowed=false;
    else throw error;
  }
  if(!allowed)return signupSuccess;
  await syncResendContact(address);
  await sendConfirmation(address);
  return signupSuccess;
}
