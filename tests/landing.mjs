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
const db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/0002_customer.sql','utf8'));
const env={
  DB:{prepare(sql){return{bind(...args){return{
    first:async()=>db.prepare(sql).get(...args),
    run:async()=>{db.prepare(sql).run(...args);return{success:true};},
  };}};}},
  ASSETS:{fetch:async()=>new Response('<h1>Fictional brands.</h1>',{headers:{'Content-Type':'text/html'}})},
};
const request=(body,origin='https://wronggoods.com')=>new Request('https://wronggoods.com/api/signup',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)});
test('landing signup reaches persistent storage, requires consent and origin, and deduplicates',async()=>{
  const body={email:'landing@example.test',consent:true};
  for(let i=0;i<2;i++){const response=await worker.fetch(request(body),env);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
  assert.equal(db.prepare('SELECT count(*) AS n FROM launch_signups').get().n,1);
  assert.equal((await worker.fetch(request({...body,consent:false}),env)).status,400);
  assert.equal((await worker.fetch(request(body,'https://other.example'),env)).status,403);
  assert.equal(db.prepare('SELECT count(*) AS n FROM launch_signups').get().n,1);
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
process.on('exit',()=>{db.close();rmSync(dir,{recursive:true,force:true});});
