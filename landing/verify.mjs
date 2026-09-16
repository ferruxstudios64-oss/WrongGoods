import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const origin=process.argv[2]||'http://127.0.0.1:8790';const checks=[];
async function check(path,expected,init){const response=await fetch(origin+path,{...init,signal:AbortSignal.timeout(20000)});assert.equal(response.status,expected,path);checks.push({path,status:response.status});return response;}
const home=await check('/',200);const html=await home.text();assert.match(html,/FICTIONAL<br>BRANDS/);assert.match(html,/AI-generated concept image/);assert.match(html,/hello@wronggoods.com/);assert.doesNotMatch(html,new RegExp(`tawseen@${'wronggoods.com'}|CONTRABAND MOCKUPS|FREE SAMPLE FILE|PHOTOSHOP \\+ AFFINITY`));assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
if(origin.includes('.workers.dev'))assert.equal(home.headers.get('x-robots-tag'),'noindex, nofollow');
const results=await Promise.allSettled(['/styles.css','/app.js','/assets/dayshift.webp','/privacy.html','/favicon.svg','/robots.txt'].map(path=>check(path,200)));for(const result of results)if(result.status==='rejected')throw result.reason;
await check('/api/signup',405);await check('/api/unknown',404);
await check('/api/signup',403,{method:'POST',headers:{origin:'https://unrelated.example','content-type':'application/json'},body:JSON.stringify({email:'verification@example.test',consent:true})});
await check('/api/signup',400,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'verification@example.test',consent:false})});
await check('/api/signup',413,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({padding:'a'.repeat(13000)})});
writeFileSync('artifacts/landing-http.json',JSON.stringify({origin,checkedAt:new Date().toISOString(),checks},null,2)+'\n');console.log(`Landing verification passed: ${checks.length} HTTP checks, positioning, privacy, asset delivery and security headers.`);
