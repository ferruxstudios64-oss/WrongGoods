import {setting,supabaseConfig,database} from './env';
import {supabaseRequest,rpc} from './supabase';
import {HttpError} from './auth';
import {readCustomerRequest,throttle} from '../customer';

export const OWNER_COOKIE='wg_owner';
export function ownerToken(request: Request) {return request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(`${OWNER_COOKIE}=`))?.slice(OWNER_COOKIE.length+1)||'';}
function allowed(email: string) {return setting('OWNER_EMAILS').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());}
function authConfig() {return {...supabaseConfig(),key:setting('SUPABASE_PUBLISHABLE_KEY')};}
function sameOrigin(request:Request) {if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Request origin was rejected.');}
export async function validateOwnerToken(token:string):Promise<string> {
  if(!token || token.length>12000)throw new HttpError(401,'Sign in to the owner studio.');
  // Auth's user endpoint verifies the token and current user, rather than trusting decoded claims.
  const response=await supabaseRequest(authConfig(),'/auth/v1/user',{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new HttpError(response.status>=500?503:401,'Your session has expired. Sign in again.');
  const user=await response.json() as {id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean};
  if(!user.email_confirmed_at||user.is_anonymous||!user.email||!allowed(user.email))throw new HttpError(403,'This account does not have owner access.');
  let claims:{session_id?:string;sub?:string};
  try {claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new HttpError(401,'Invalid owner session.');}
  if(claims.sub!==user.id||!claims.session_id||!/^[a-f0-9-]{36}$/.test(claims.session_id))throw new HttpError(401,'Invalid owner session.');
  const result=await rpc(supabaseConfig(),[{name:'owner_session_active',args:[claims.session_id,user.id]}]);
  if(result[0]?.results[0]?.active!==true)throw new HttpError(401,'Your session has ended. Sign in again.');
  return user.email.toLowerCase();
}
export async function requireSupabaseOwner(request:Request) {if(!['GET','HEAD'].includes(request.method))sameOrigin(request);return validateOwnerToken(ownerToken(request));}
function cookie(request:Request,token:string,age:number) {return `${OWNER_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function signInOwner(request:Request) {
  const body=await readCustomerRequest(request);
  await throttle(database(),`owner-login:${request.headers.get('cf-connecting-ip')||'local'}`,10);
  if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length>256||!allowed(body.email.trim()))throw new HttpError(401,'Check your owner email and password.');
  const response=await supabaseRequest(authConfig(),'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:body.email.trim(),password:body.password})});
  if(!response.ok)throw new HttpError(response.status===429?429:401,'Sign-in failed. Check your email and password, or try again later.');
  const session=await response.json() as {access_token:string;expires_in:number};
  const email=await validateOwnerToken(session.access_token);
  return Response.json({email},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie(request,session.access_token,Math.max(0,Math.min(3600,session.expires_in)))}});
}
export async function signOutOwner(request:Request) {
  sameOrigin(request);const token=ownerToken(request);
  let revoked=true;
  if(token){const response=await supabaseRequest(authConfig(),'/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:`Bearer ${token}`}});revoked=response.ok||response.status===401||response.status===403;}
  return Response.json(revoked?{message:'Signed out.'}:{error:'This browser is signed out, but session revocation failed. Retry signing out from your Supabase account.'},{status:revoked?200:503,headers:{'Cache-Control':'no-store','Set-Cookie':cookie(request,'',0)}});
}
