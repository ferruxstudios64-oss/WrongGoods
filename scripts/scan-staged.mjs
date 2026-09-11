import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const files=git('diff','--cached','--name-only','--diff-filter=ACMR','-z').split('\0').filter(Boolean);
const forbidden=/(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|node_modules|dist|\.wrangler|\.sites-runtime)(\/|$)|\.(zip|7z|rar|pem|key|p12|pfx)$/i;
const secrets=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{20,}/,/\bgithub_pat_[A-Za-z0-9_]{30,}/,/\bsk_live_[A-Za-z0-9]{16,}/,/\bAKIA[A-Z0-9]{16}\b/,/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/];
const failures=[];
for(const file of files){if(forbidden.test(file)){failures.push(`${file}: forbidden file type/path`);continue;}if(/\.(png|jpe?g|webp|ttf|woff2?)$/i.test(file))continue;const content=git('show',`:${file}`);if(secrets.some(pattern=>pattern.test(content)))failures.push(`${file}: credential-like content (value withheld)`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log(`Staged scan passed: ${files.length} files; no forbidden paths or high-confidence credential patterns. Screenshots require visual review separately.`);
