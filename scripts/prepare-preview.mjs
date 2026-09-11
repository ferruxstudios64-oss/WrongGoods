import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const path = new URL('../dist/server/wrangler.json',import.meta.url);
const config=JSON.parse(readFileSync(path,'utf8'));
// Resource IDs are not credentials. Keeping the approved target in version control
// prevents a routine redeploy from accidentally disconnecting persistent data.
const target=JSON.parse(readFileSync(new URL('../deploy/preview.json',import.meta.url),'utf8'));
const supabase=target.backend==='supabase'?target.supabase:null;
if(supabase){const local=parseEnv(readFileSync(new URL('../.dev.vars',import.meta.url),'utf8'));if(!local.SUPABASE_SECRET_KEY)throw Error('Save SUPABASE_SECRET_KEY in .dev.vars and run scripts/configure-supabase.mjs before switching the preview.');}
const databaseId=process.env.WRONGGOODS_PREVIEW_DATABASE_ID??target.database?.id;
const bucket=process.env.WRONGGOODS_PREVIEW_BUCKET??target.privateBucket;
if(databaseId&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(databaseId))throw Error('Use the actual Cloudflare preview database UUID.');
if(databaseId==='00000000-0000-4000-8000-000000000000')throw Error('The local placeholder database cannot be deployed.');
if(bucket&&!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Invalid private preview bucket name.');
config.name='wronggoods-preview';
config.topLevelName='wronggoods-preview';
config.workers_dev=true;
config.preview_urls=false;
config.routes=[];
config.d1_databases=!supabase&&databaseId?[{binding:'DB',database_name:'wronggoods-preview',database_id:databaseId,migrations_dir:'../../migrations'}]:[];
config.r2_buckets=!supabase&&bucket?[{binding:'BUCKET',bucket_name:bucket}]:[];
config.observability={enabled:false};
config.vars={COMMERCE_LIVE_ENABLED:'false'};
if(supabase)Object.assign(config.vars,{SUPABASE_URL:supabase.url,SUPABASE_PUBLISHABLE_KEY:supabase.publishableKey,SUPABASE_PRIVATE_BUCKET:supabase.privateBucket});
config.keep_vars=true;
writeFileSync(new URL('../dist/server/wrangler.preview.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log(`Prepared separate wronggoods-preview Worker; backend ${supabase?'Supabase':databaseId?'D1':'disabled'}, live payments disabled, no domain routes.`);
