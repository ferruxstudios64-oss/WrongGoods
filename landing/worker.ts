import {CustomerError,readCustomerRequest,saveSignup,throttle} from '../lib/customer';
type Bindings={DB:D1Database;ASSETS:Fetcher;RESEND_API_KEY:string};
const segmentId='e812ada8-5c77-49bd-ba93-5a4135a87345';
const signupMessage='You’re on the release list. Check your inbox for confirmation.';
const savedButEmailFailed='Your signup is saved and you remain on the release list, but we could not send the confirmation email. Please try again later.';

async function resend(env:Bindings,path:string,init:RequestInit={}){
  return fetch(`https://api.resend.com${path}`,{
    ...init,
    headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json',...init.headers},
  });
}
async function responseText(response:Response){try{return await response.text();}catch{return '';}}
async function syncResendContact(env:Bindings,address:string){
  const create=await resend(env,'/contacts',{method:'POST',body:JSON.stringify({email:address,unsubscribed:false,segments:[{id:segmentId}]})});
  if(create.ok)return;
  const detail=await responseText(create);
  const conflict=create.status===409||(create.status===422&&/already|exist/i.test(detail));
  if(!conflict)throw new Error(`Resend contact sync failed (${create.status}).`);
  const contact=encodeURIComponent(address);
  const update=await resend(env,`/contacts/${contact}`,{method:'PATCH',body:JSON.stringify({unsubscribed:false})});
  if(!update.ok)throw new Error(`Resend contact update failed (${update.status}).`);
  const addToSegment=await resend(env,`/contacts/${contact}/segments/${segmentId}`,{method:'POST'});
  if(!addToSegment.ok&&addToSegment.status!==409)throw new Error(`Resend segment sync failed (${addToSegment.status}).`);
}
async function confirmationKey(address:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(address));
  return `signup-confirmation-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
async function sendConfirmation(env:Bindings,address:string){
  const response=await resend(env,'/emails',{
    method:'POST',
    headers:{'Idempotency-Key':await confirmationKey(address)},
    body:JSON.stringify({template:{id:'signup-confirmation'},to:[address]}),
  });
  if(!response.ok)throw new Error(`Resend confirmation failed (${response.status}).`);
}
export default {
  async fetch(request:Request,env:Bindings):Promise<Response>{
    const url=new URL(request.url);let response:Response=Response.json({error:'Unexpected error.'},{status:500});
    if(url.pathname==='/api/signup'){
      if(request.method!=='POST')response=Response.json({error:'Use the signup form.'},{status:405,headers:{Allow:'POST'}});
      else try{
        const body=await readCustomerRequest(request);
        await throttle(env.DB,`landing-signup:${request.headers.get('cf-connecting-ip')||'local'}`,10);
        await saveSignup(env.DB,body);
        const address=String(body.email).trim().toLowerCase();
        let confirmationAllowed=true;
        try{
          try{await throttle(env.DB,`landing-confirmation:${address}`,1);}
          catch(error){
            if(error instanceof CustomerError&&error.status===429){confirmationAllowed=false;response=Response.json({message:signupMessage});}
            else throw error;
          }
          if(confirmationAllowed){await syncResendContact(env,address);await sendConfirmation(env,address);response=Response.json({message:signupMessage});}
        }
        catch(error){console.error('Signup saved but confirmation delivery failed.',error);response=Response.json({error:savedButEmailFailed},{status:502});}
      }
      catch(error){response=Response.json({error:error instanceof CustomerError?error.message:'Your request was not saved. Please try again or email hello@wronggoods.com.'},{status:error instanceof CustomerError?error.status:503});}
    }else if(url.pathname.startsWith('/api/'))response=Response.json({error:'Not found.'},{status:404});
    else response=await env.ASSETS.fetch(request);
    response=new Response(response.body,response);
    response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(url.pathname.startsWith('/api/'))response.headers.set('Cache-Control','no-store');
    if(url.hostname.endsWith('.workers.dev'))response.headers.set('X-Robots-Tag','noindex, nofollow');
    return response;
  }
} satisfies ExportedHandler<Bindings>;
