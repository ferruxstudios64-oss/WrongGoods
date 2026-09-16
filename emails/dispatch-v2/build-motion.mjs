// Code-native decorative animation. No subscriber data or remote requests.
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const out=resolve('landing/public/email-assets');
mkdirSync(out,{recursive:true});
const temp=mkdtempSync(join(tmpdir(),'wg-motion-'));
const font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
for(const kind of ['stamp','scanner']){
  const frames=[];
  for(let i=0;i<24;i++){
    const file=join(temp,`${kind}-${i}.png`);
    const args=['-size',kind==='stamp'?'360x112':'1200x12','xc:#D9DE21'];
    if(kind==='stamp'){
      const inset=i===0||i>=9?8:Math.round(8+12*(1-i/9));
      args.push('-fill','none','-stroke','#0A0A0A','-strokewidth','4','-draw',`rectangle ${inset},${inset} ${360-inset},${112-inset}`,'-fill','#0A0A0A','-stroke','none','-font',font,'-pointsize','48','-gravity','center','-annotate','+0+0','CLEARED');
    }else{
      const x=i===0||i===23?1080:Math.round(i/23*1080);
      args.push('-fill','#0A0A0A','-draw',`rectangle ${x},0 ${x+120},12`);
    }
    execFileSync('convert',[...args,file]);
    frames.push('-delay',i===0?'65':i===23?'120':'9',file);
  }
  // No NETSCAPE loop extension: play once, then retain the final complete frame.
  execFileSync('convert',[...frames,'-dispose','none','-layers','Optimize','-loop','1',join(out,`dispatch-${kind}-v2.gif`)]);
}
console.log('Created one-shot stamp and scanner GIFs; both first frames are complete.');
