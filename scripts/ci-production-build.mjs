import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

if(process.env.GITHUB_ACTIONS!=='true'){
  console.log('Skipping production build preparation outside GitHub Actions.');
  process.exit(0);
}

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const build=spawnSync(process.execPath,[resolve(root,'scripts/run-framework.mjs'),'build'],{
  cwd:root,
  stdio:'inherit',
  env:process.env,
});
if(build.status!==0)process.exit(build.status??1);

const generatedPath=resolve(root,'dist/server/wrangler.json');
if(!existsSync(generatedPath))throw new Error('Production build did not emit dist/server/wrangler.json.');

const generatedDir=dirname(generatedPath);
const targetPath=resolve(root,'landing/wrangler.production.jsonc');
const targetDir=dirname(targetPath);
const config=JSON.parse(readFileSync(generatedPath,'utf8'));

function rebase(value){
  if(typeof value!=='string'||!value)return value;
  return relative(targetDir,resolve(generatedDir,value)).split(sep).join('/');
}

config.name='wrongergoods';
if('topLevelName' in config)config.topLevelName='wrongergoods';
config.workers_dev=false;
config.preview_urls=false;
config.routes=[
  {pattern:'wronggoods.com',custom_domain:true},
  {pattern:'www.wronggoods.com',custom_domain:true},
];
if(config.main)config.main=rebase(config.main);
if(config.assets?.directory)config.assets.directory=rebase(config.assets.directory);
if(config.site?.bucket)config.site.bucket=rebase(config.site.bucket);
config.d1_databases=[{
  binding:'DB',
  database_name:'wronggoods-preview',
  database_id:'d85bce0e-d804-43a3-bcb8-e7293b4c3135',
  migrations_dir:'../migrations',
}];
config.r2_buckets=[];
config.vars={...(config.vars||{}),COMMERCE_LIVE_ENABLED:'false',OWNER_MAGIC_LINK_ENABLED:'true'};
config.keep_vars=true;
config.observability={enabled:false};

writeFileSync(targetPath,JSON.stringify(config,null,2)+'\n');
console.log('Prepared Storefront v1 production config for the existing wrongergoods Worker.');
