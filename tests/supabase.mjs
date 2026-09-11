import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'wg-supabase-'));
for(const name of ['supabase','supabase-database','supabase-queries','supabase-auth','auth']){
  const source=readFileSync(`lib/server/${name}.ts`,'utf8').replaceAll(/'\.\/([^']+)'/g,"'./$1.mjs'").replace("'../customer'","'./customer.mjs'");
  writeFileSync(join(dir,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
}
writeFileSync(join(dir,'customer.mjs'),ts.transpileModule(readFileSync('lib/customer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
writeFileSync(join(dir,'env.mjs'),`export const setting=n=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-fixture',OWNER_EMAILS:'owner@example.test'}[n]||'');export const supabaseConfig=()=>({url:setting('SUPABASE_URL'),key:'server-fixture',bucket:'private'});export const database=()=>({prepare(){return{bind(){return{first:async()=>({count:1}),run:async()=>({success:true})}}}}});`);
const auth=await import(pathToFileURL(join(dir,'supabase-auth.mjs')));
const {supabaseDatabase}=await import(pathToFileURL(join(dir,'supabase-database.mjs')));
const {supabaseStorage}=await import(pathToFileURL(join(dir,'supabase.mjs')));
const user={id:'00000000-0000-4000-8000-000000000001',email:'owner@example.test',email_confirmed_at:'2026-09-11',is_anonymous:false};
const token=`header.${Buffer.from(JSON.stringify({sub:user.id,session_id:'00000000-0000-4000-8000-000000000002'})).toString('base64url')}.signature`;
const original=globalThis.fetch;const config={url:'https://example.supabase.co',key:'server-fixture',bucket:'private'};
test('Supabase owner auth rejects invalid, unconfirmed, other-user and revoked sessions',async()=>{
  await assert.rejects(auth.validateOwnerToken(''),e=>e.status===401);
  globalThis.fetch=async()=>Response.json({error:'invalid JWT'},{status:401});await assert.rejects(auth.validateOwnerToken(token),e=>e.status===401);
  for(const changes of [{email:'other@example.test',user_metadata:{admin:true}},{email_confirmed_at:null},{is_anonymous:true}]){globalThis.fetch=async()=>Response.json({...user,...changes});await assert.rejects(auth.validateOwnerToken(token),e=>e.status===403);}
  globalThis.fetch=async url=>String(url).endsWith('/user')?Response.json(user):Response.json([{results:[{active:false}]}]);await assert.rejects(auth.validateOwnerToken(token),e=>e.status===401);
  globalThis.fetch=async url=>String(url).endsWith('/user')?Response.json(user):Response.json([{results:[{active:true}]}]);assert.equal(await auth.validateOwnerToken(token),user.email);
  await assert.rejects(auth.requireSupabaseOwner(new Request('https://shop.example/api/owner/products',{method:'POST',headers:{origin:'https://evil.example',cookie:`wg_owner=${token}`}})),e=>e.status===403);
});
test('Supabase login keeps tokens in a secure HTTP-only cookie and logout revokes the session',async()=>{
  const calls=[];globalThis.fetch=async(url,init)=>{calls.push([String(url),init]);if(String(url).includes('/token?'))return Response.json({access_token:token,expires_in:3600,refresh_token:'never-expose'});if(String(url).endsWith('/user'))return Response.json(user);if(String(url).includes('/logout?'))return new Response(null,{status:204});return Response.json([{results:[{active:true}]}]);};
  const request=new Request('https://shop.example/api/owner/session',{method:'POST',headers:{origin:'https://shop.example','content-type':'application/json'},body:JSON.stringify({email:user.email,password:'local-fixture-password'})});
  const response=await auth.signInOwner(request);assert.equal(response.status,200);assert.deepEqual(await response.json(),{email:user.email});assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Path=\/; Max-Age=3600; Secure/);
  const logout=await auth.signOutOwner(new Request(request.url,{method:'DELETE',headers:{origin:'https://shop.example',cookie:`wg_owner=${token}`}}));assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.ok(calls.some(([url])=>url.endsWith('/logout?scope=local')));
});
test('Supabase compatibility transport rejects arbitrary SQL and sends batches as a single RPC',async()=>{
  const db=supabaseDatabase(config);assert.throws(()=>db.prepare('DROP TABLE products'));const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push([String(url),JSON.parse(init.body)]);return Response.json([{results:[],success:true,meta:{changes:0}},{results:[],success:true,meta:{changes:0}}]);};
  await db.batch([db.prepare('DELETE FROM assets WHERE id=?').bind('asset'),db.prepare("DELETE FROM products WHERE id=? AND revision=? AND state='draft'").bind('draft',2)]);assert.equal(calls.length,1);assert.equal(calls[0][1].operations.length,2);assert.equal(calls[0][1].operations[0].args[0],'asset');assert.equal('sql' in calls[0][1].operations[0],false);
});
test('private storage errors cannot appear to be successful uploads',async()=>{
  const storage=supabaseStorage(config);globalThis.fetch=async()=>new Response(null,{status:403});await assert.rejects(storage.put('draft/file',new Uint8Array([1])));await assert.rejects(storage.get('draft/file'));await assert.rejects(storage.head('draft/file'));globalThis.fetch=async()=>new Response(null,{status:404});assert.equal(await storage.get('missing'),null);
});
process.on('exit',()=>{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true});});
