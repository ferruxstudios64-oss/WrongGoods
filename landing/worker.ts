import {CustomerError,readCustomerRequest,saveSignup,throttle} from '../lib/customer';
type Bindings={DB:D1Database;ASSETS:Fetcher};
export default {
  async fetch(request:Request,env:Bindings):Promise<Response>{
    const url=new URL(request.url);let response:Response;
    if(url.pathname==='/api/signup'){
      if(request.method!=='POST')response=Response.json({error:'Use the signup form.'},{status:405,headers:{Allow:'POST'}});
      else try{const body=await readCustomerRequest(request);await throttle(env.DB,`landing-signup:${request.headers.get('cf-connecting-ip')||'local'}`,10);response=Response.json(await saveSignup(env.DB,body));}
      catch(error){response=Response.json({error:error instanceof CustomerError?error.message:'Your request was not saved. Please try again or email tawseen@wronggoods.com.'},{status:error instanceof CustomerError?error.status:503});}
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
