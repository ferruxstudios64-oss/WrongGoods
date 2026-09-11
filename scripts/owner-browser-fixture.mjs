// Isolated browser-test harness. Never deployed. No real Cloudflare/merchant account is used.
// Reuses signed JWT + real SQLite handler fixtures from the workflow test, then proxies
// only the UI from the dev server. Owner APIs use a separate, in-memory test database.
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.');
const temp=mkdtempSync(join(root,'.sites-runtime','owner-browser-'));
let source=readFileSync('tests/owner-workflow.mjs','utf8').split("test('signed owner workflow")[0];
source=source.replace("'./upload-fixtures.js'",JSON.stringify(pathToFileURL(resolve('tests/upload-fixtures.js')).href));
source+=String.raw`
const {createServer}=await import('node:http');
const routeFor=path=>{
  if(path==='/api/owner/products')return {route:api.products,params:{}};
  let match;
  if((match=path.match(/^\/api\/owner\/products\/([^/]+)(?:\/(upload|publish|archive))?$/)))return {route:api[match[2]||'product'],params:{id:match[1]}};
  if((match=path.match(/^\/api\/(owner\/)?media\/([^/]+)$/)))return {route:api[match[1]?'privateMedia':'mediaRoute'],params:{id:match[2]}};
  if((match=path.match(/^\/api\/owner\/products\/([^/]+)\/assets\/([^/]+)$/)))return {route:api.remove,params:{id:match[1],assetId:match[2]}};
};
const server=createServer(async(incoming,outgoing)=>{try{
  const url=new URL(incoming.url,'http://127.0.0.1:5199');
  if(url.pathname==='/__fixture-login'){outgoing.writeHead(302,{'Set-Cookie':'wg_fixture='+jwt+'; HttpOnly; SameSite=Strict; Path=/','Location':'/owner'});outgoing.end();return;}
  const found=routeFor(url.pathname);
  const chunks=[];for await(const chunk of incoming)chunks.push(chunk);const bytes=Buffer.concat(chunks);
  let response;
  if(found){
    const headers=new Headers();for(const [name,value]of Object.entries(incoming.headers))if(typeof value==='string')headers.set(name,value);
    const auth=incoming.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('wg_fixture='))?.slice(11);
    headers.delete('cf-access-jwt-assertion');if(auth)headers.set('cf-access-jwt-assertion',auth);
    if(headers.has('origin'))headers.set('origin','https://wronggoods.com');
    const request=new Request('https://wronggoods.com'+url.pathname,{method:incoming.method,headers,...(bytes.length?{body:bytes}:{})});
    const handler=found.route[incoming.method];response=handler?await handler(request,{params:Promise.resolve(found.params)}):new Response('Method not allowed',{status:405});
  }else{
    response=await realFetch('http://localhost:5173'+incoming.url,{method:incoming.method,headers:{'accept':incoming.headers.accept||'*/*'},...(bytes.length?{body:bytes}:{}),redirect:'manual'});
  }
  outgoing.statusCode=response.status;response.headers.forEach((value,name)=>{if(!['content-length','content-encoding','transfer-encoding'].includes(name))outgoing.setHeader(name,value);});
  outgoing.setHeader('X-WrongGoods-Test-Fixture','isolated');outgoing.end(Buffer.from(await response.arrayBuffer()));
}catch(error){outgoing.writeHead(500);outgoing.end(String(error));}});
server.listen(5199,'127.0.0.1',()=>console.log('Isolated owner browser fixture: http://127.0.0.1:5199/__fixture-login (test identities and products only)'));
process.on('SIGINT',()=>{server.close();sql.close();rmSync(dir,{recursive:true,force:true});process.exit();});
`;
// This generated module is ignored and lives beneath the project so dependencies resolve.
const file=join(temp,'server.mjs');writeFileSync(file,source);await import(pathToFileURL(file));
