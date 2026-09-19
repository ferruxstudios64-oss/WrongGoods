import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin=new URL(process.argv[2]||'http://127.0.0.1:8787').origin;
const records=[];
for(const path of ['/','/goods','/goods/dayshift','/about','/licence','/terms','/refunds','/privacy','/contact','/owner','/owner/inbox','/order','/order?status=cancelled','/does-not-exist','/goods/public-notice','/goods/false-authority','/sitemap.xml','/robots.txt']){
  const r=await fetch(origin+path);const text=await r.text();
  const expected=['/does-not-exist','/goods/public-notice','/goods/false-authority'].includes(path)?404:200;
  assert.equal(r.status,expected,`${path} HTTP status`);
  if(r.headers.get('content-type')?.includes('text/html')){
    assert.ok(text.includes('WrongGoods'),`${path} body`);
    assert.ok(!text.includes('Internal Server Error'),`${path} render`);
  }
  records.push({path,status:r.status,bytes:text.length,robots:r.headers.get('x-robots-tag')});
}
for(const [path,statuses] of [['/api/owner/products',[401,503]],['/api/owner/inbox',[401,503]],['/api/owner/media/unknown',[401,503]],['/api/media/unknown',[404,503]],['/api/downloads/private.zip',[401]],['/api/orders/status?status=paid',[401]]]){
  const r=await fetch(origin+path);assert.ok(statuses.includes(r.status),`${path} rejected`);records.push({path,status:r.status});
}
const forged=await fetch(origin+'/api/checkout',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:'{"slug":"dayshift"}'});assert.equal(forged.status,403);
const concept=await fetch(origin+'/api/checkout',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{"slug":"dayshift"}'});assert.ok([409,503].includes(concept.status));
const recovery=await fetch(origin+'/api/orders/recover',{redirect:'manual'});assert.equal(recovery.headers.get('location'),'https://app.lemonsqueezy.com/my-orders');
mkdirSync('artifacts',{recursive:true});const report={origin,checkedAt:new Date().toISOString(),checks:records,forgedCheckout:forged.status,conceptCheckout:concept.status,recovery:recovery.headers.get('location')};
writeFileSync(`artifacts/http-${origin.includes('workers.dev')?'deployed':'local'}.json`,JSON.stringify(report,null,2)+'\n');console.log(`HTTP smoke passed: ${records.length+3} checks at ${origin}`);
