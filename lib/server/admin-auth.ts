import {getBindings,setting} from './env';
import {HttpError} from './auth';
import {readCustomerRequest,throttle} from '../customer';

export const ADMIN_COOKIE='wg_admin';
const LOGIN_TTL=900;
const SESSION_TTL=43200;

function d1(){const db=getBindings().DB;if(!db)throw new HttpError(503,'Admin access is not configured.');return db;}
let schemaReady=false;
async function ensureSchema(){
  if(schemaReady)return;
  const db=d1();
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_users (email TEXT PRIMARY KEY, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_login_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)").run();
  await db.prepare("INSERT INTO admin_users (email,role,active,created_at) VALUES (?,?,1,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=1").bind('tawseen@wronggoods.com','admin',Math.floor(Date.now()/1000)).run();
  schemaReady=true;
}
function sameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Request origin was rejected.');}
function cookieValue(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1)||'';}
function randomToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function hashToken(token:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
function sessionCookie(request:Request,token:string,age:number){return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}

async function sendLoginEmail(email:string,link:string){
  const key=setting('RESEND_API_KEY');
  if(!key)throw new HttpError(503,'Admin email delivery is unavailable.');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({
    from:'WrongGoods <hello@wronggoods.com>',to:[email],subject:'WrongGoods admin sign-in',
    text:`Use this private link to sign in to the WrongGoods admin area:\n\n${link}\n\nThe link expires in 15 minutes and can only be used once.`,
    html:`<div style="background:#0c0c0c;color:#eae7da;padding:32px;font-family:Arial,sans-serif"><p style="font:12px monospace;color:#e7f03a">WRONGGOODS / ADMIN ACCESS</p><h1 style="font-size:34px;margin:20px 0">Private sign-in.</h1><p>Use the link below to access the Storefront v1 preview and owner tools.</p><p style="margin:28px 0"><a href="${link}" style="background:#e7f03a;color:#0c0c0c;padding:14px 18px;text-decoration:none;font-weight:700">Sign in to WrongGoods</a></p><p style="color:#aaa79e;font-size:12px">This link expires in 15 minutes and can only be used once.</p></div>`
  })});
  if(!response.ok)throw new HttpError(503,'Admin sign-in email could not be sent.');
}

export async function requestAdminLink(request:Request){
  sameOrigin(request);
  const body=await readCustomerRequest(request);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(!email||email.length>254)throw new HttpError(400,'Enter a valid admin email.');
  await ensureSchema();
  const db=d1();
  await throttle(db,`admin-login:${request.headers.get('cf-connecting-ip')||'local'}:${email}`,5);
  const admin=await db.prepare("SELECT email, role FROM admin_users WHERE email = ? AND active = 1").bind(email).first<{email:string;role:string}>();
  const message='If that email has admin access, a private sign-in link has been sent.';
  if(!admin||admin.role!=='admin')return Response.json({message},{headers:{'Cache-Control':'no-store'}});
  const raw=randomToken(),digest=await hashToken(raw),now=Math.floor(Date.now()/1000);
  await db.prepare('DELETE FROM admin_login_tokens WHERE expires_at < ? OR email = ?').bind(now,email).run();
  await db.prepare('INSERT INTO admin_login_tokens (token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').bind(digest,email,now+LOGIN_TTL,now).run();
  const link=`${new URL(request.url).origin}/owner/verify?token=${encodeURIComponent(raw)}`;
  try{await sendLoginEmail(email,link);}catch(error){await db.prepare('DELETE FROM admin_login_tokens WHERE token_hash = ?').bind(digest).run();throw error;}
  return Response.json({message},{headers:{'Cache-Control':'no-store'}});
}

export async function validateAdminSession(token:string){
  if(!token||token.length>200)throw new HttpError(401,'Admin sign-in required.');
  await ensureSchema();
  const digest=await hashToken(token),now=Math.floor(Date.now()/1000);
  const row=await d1().prepare("SELECT s.email AS email,u.role AS role FROM admin_sessions s JOIN admin_users u ON u.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(digest,now).first<{email:string;role:string}>();
  if(!row||row.role!=='admin')throw new HttpError(401,'Your admin session has expired. Sign in again.');
  return row.email;
}
export async function requireAdmin(request:Request){if(!['GET','HEAD'].includes(request.method))sameOrigin(request);return validateAdminSession(cookieValue(request,ADMIN_COOKIE));}

export async function verifyAdminLink(request:Request){
  const token=new URL(request.url).searchParams.get('token')||'';
  if(!token||token.length>200)return Response.redirect(new URL('/owner?login=invalid',request.url),302);
  await ensureSchema();
  const digest=await hashToken(token),now=Math.floor(Date.now()/1000),db=d1();
  const row=await db.prepare("SELECT t.email AS email,u.role AS role FROM admin_login_tokens t JOIN admin_users u ON u.email=t.email WHERE t.token_hash=? AND t.expires_at>? AND u.active=1").bind(digest,now).first<{email:string;role:string}>();
  if(!row||row.role!=='admin')return Response.redirect(new URL('/owner?login=invalid',request.url),302);
  await db.prepare('DELETE FROM admin_login_tokens WHERE token_hash=?').bind(digest).run();
  const session=randomToken(),sessionHash=await hashToken(session);
  await db.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR email = ?').bind(now,row.email).run();
  await db.prepare('INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').bind(sessionHash,row.email,now+SESSION_TTL,now).run();
  const response=Response.redirect(new URL('/goods',request.url),302);
  response.headers.set('Set-Cookie',sessionCookie(request,session,SESSION_TTL));
  response.headers.set('Cache-Control','no-store');
  return response;
}

export async function signOutAdmin(request:Request){
  sameOrigin(request);
  await ensureSchema();
  const token=cookieValue(request,ADMIN_COOKIE);
  if(token){const digest=await hashToken(token);await d1().prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(digest).run();}
  return Response.json({message:'Signed out.'},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(request,'',0)}});
}
