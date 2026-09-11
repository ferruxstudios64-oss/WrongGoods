// Reads credentials only from ignored local settings. Never prints keys or passwords.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const local=parseEnv(readFileSync('.dev.vars','utf8'));
const target=JSON.parse(readFileSync('deploy/preview.json','utf8')).supabase;
if(!target||local.SUPABASE_URL!==target.url||!local.SUPABASE_SECRET_KEY)throw Error('Save the intended SUPABASE_URL and SUPABASE_SECRET_KEY in .dev.vars first.');
const key=local.SUPABASE_SECRET_KEY;
const headers={apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})};
async function request(path,init={}){return fetch(target.url+path,{...init,headers:{...headers,...init.headers},redirect:'error',signal:AbortSignal.timeout(20000)});}
const db=await request('/rest/v1/rpc/wg_storefront_batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operations:[]})});
if(!db.ok)throw Error(`Supabase server credential/database check failed (${db.status}).`);
console.log('Supabase server credential and database RPC verified.');
const bucketPath=`/storage/v1/bucket/${target.privateBucket}`;
let bucket=await request(bucketPath);
if(!bucket.ok&&process.argv.includes('--configure')){
  // A dedicated namespace avoids inheriting existing catalogue-admin storage policies.
  if(![400,404].includes(bucket.status))throw Error(`Bucket inspection failed (${bucket.status}).`);
  const created=await request('/storage/v1/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:target.privateBucket,name:target.privateBucket,public:false,file_size_limit:25*1024*1024,allowed_mime_types:['image/png','image/jpeg','image/webp','application/zip']})});
  if(!created.ok)throw Error(`Private bucket creation failed (${created.status}).`);
  bucket=await request(bucketPath);
}
if(!bucket.ok)throw Error('The private studio bucket is missing. Run this script with --configure.');
const details=await bucket.json();if(details.public!==false)throw Error('Refusing to use a public studio bucket.');
console.log('Private studio bucket verified.');
if(process.argv.includes('--upload-secrets')){
  const secrets={SUPABASE_SECRET_KEY:key,OWNER_EMAILS:local.OWNER_EMAILS};
  if(!secrets.OWNER_EMAILS)throw Error('OWNER_EMAILS is required.');
  const result=spawnSync('cmd.exe',['/d','/s','/c','pnpm exec wrangler secret bulk --config dist/server/wrangler.preview.json'],{input:JSON.stringify(secrets),encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw Error('Worker secret upload failed. Run Wrangler login locally and retry.');
  console.log('Server credentials saved as Worker secrets.');
}
