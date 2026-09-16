import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'wg-landing-'));
for(const [source,name] of [['landing/worker.ts','worker'],['lib/customer.ts','customer']])writeFileSync(join(dir,`${name}.mjs`),ts.transpileModule(readFileSync(source,'utf8').replace("'../lib/customer'","'./customer.mjs'"),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
const worker=(await import(pathToFileURL(join(dir,'worker.mjs')))).default;
const originalFetch=globalThis.fetch;const resendCalls=[];
const successfulResend=async(input,init={})=>{resendCalls.push({url:String(input),init});return Response.json({id:'resend-test-id'});};
globalThis.fetch=successfulResend;
const db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/0002_customer.sql','utf8'));
const env={
  DB:{prepare(sql){return{bind(...args){return{
    first:async()=>db.prepare(sql).get(...args),
    run:async()=>{db.prepare(sql).run(...args);return{success:true};},
  };}};}},
  ASSETS:{fetch:async()=>new Response('<h1>Fictional brands.</h1>',{headers:{'Content-Type':'text/html'}})},
  RESEND_API_KEY:'re_test_placeholder',
};
const request=(body,origin='https://wronggoods.com')=>new Request('https://wronggoods.com/api/signup',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)});
test('landing signup reaches persistent storage, requires consent and origin, and deduplicates',async()=>{
  const body={email:'landing@example.test',consent:true};
  for(let i=0;i<2;i++){const response=await worker.fetch(request(body),env);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
  assert.equal(db.prepare('SELECT count(*) AS n FROM launch_signups').get().n,1);
  assert.equal(resendCalls.length,2);
  assert.deepEqual(JSON.parse(resendCalls[0].init.body),{email:'landing@example.test',unsubscribed:false,segments:[{id:'e812ada8-5c77-49bd-ba93-5a4135a87345'}]});
  assert.deepEqual(JSON.parse(resendCalls[1].init.body),{template:{id:'signup-confirmation'},to:['landing@example.test']});
  assert.match(resendCalls[1].init.headers['Idempotency-Key'],/^signup-confirmation-[a-f0-9]{64}$/);
  assert.equal((await worker.fetch(request({...body,consent:false}),env)).status,400);
  assert.equal((await worker.fetch(request(body,'https://other.example'),env)).status,403);
  assert.equal(db.prepare('SELECT count(*) AS n FROM launch_signups').get().n,1);
});
test('existing Resend contacts are resubscribed and restored to the launch segment',async()=>{
  const calls=[];globalThis.fetch=async(input,init={})=>{calls.push({url:String(input),init});if(calls.length===1)return Response.json({message:'Contact already exists'},{status:409});return Response.json({id:'resend-test-id'});};
  try{
    const response=await worker.fetch(new Request('https://wronggoods.com/api/signup',{method:'POST',headers:{origin:'https://wronggoods.com','content-type':'application/json','cf-connecting-ip':'192.0.2.2'},body:JSON.stringify({email:' EXISTING@example.test ',consent:true})}),env);
    assert.equal(response.status,200);assert.equal(calls.length,4);
    assert.equal(calls[1].init.method,'PATCH');assert.equal(calls[1].url,'https://api.resend.com/contacts/existing%40example.test');
    assert.deepEqual(JSON.parse(calls[1].init.body),{unsubscribed:false});
    assert.equal(calls[2].url,'https://api.resend.com/contacts/existing%40example.test/segments/e812ada8-5c77-49bd-ba93-5a4135a87345');
    assert.equal(calls[3].url,'https://api.resend.com/emails');
  }finally{globalThis.fetch=successfulResend;}
});
test('a Resend failure reports that the D1 signup remains saved',async()=>{
  let call=0;globalThis.fetch=async()=>{call++;return call===1?Response.json({id:'contact-id'}):Response.json({message:'offline'},{status:503});};
  try{
    const response=await worker.fetch(new Request('https://wronggoods.com/api/signup',{method:'POST',headers:{origin:'https://wronggoods.com','content-type':'application/json','cf-connecting-ip':'192.0.2.3'},body:JSON.stringify({email:'saved@example.test',consent:true})}),env);
    assert.equal(response.status,502);assert.match((await response.json()).error,/signup is saved.*remain.*release list.*could not send/i);
    assert.equal(db.prepare('SELECT count(*) AS n FROM launch_signups WHERE email = ?').get('saved@example.test').n,1);
  }finally{globalThis.fetch=successfulResend;}
});
test('landing storage failures never report successful signup',async()=>{
  const response=await worker.fetch(request({email:'landing@example.test',consent:true}),{...env,DB:{prepare(){throw Error('offline')}}});assert.equal(response.status,503);assert.match((await response.json()).error,/not saved/);
});
test('landing preview is noindex, production is indexable, and unknown APIs are rejected',async()=>{
  const preview=await worker.fetch(new Request('https://wronggoods-landing-preview.example.workers.dev/'),env);assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(preview.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const live=await worker.fetch(new Request('https://wronggoods.com/'),env);assert.equal(live.headers.get('x-robots-tag'),null);
  assert.equal((await worker.fetch(new Request('https://wronggoods.com/api/nope'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://wronggoods.com/api/signup'),env)).status,405);
});
process.on('exit',()=>{globalThis.fetch=originalFetch;db.close();rmSync(dir,{recursive:true,force:true});});
