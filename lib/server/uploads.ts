import { HttpError } from './auth';
export const IMAGE_LIMIT = 10 * 1024 * 1024;
// Keep buffered multipart uploads within the Worker's memory budget.
export const ARCHIVE_LIMIT = 25 * 1024 * 1024;
function inspectZip(bytes: Uint8Array) {
  const invalid=()=>{throw new HttpError(400,'The ZIP is incomplete, encrypted or uses an unsupported archive structure.');};
  if(bytes.length<22)invalid();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)invalid();
  if(view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)invalid();
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
  if(!count||count===65535||count>10000||start+size!==end||view.getUint16(end+8,true)!==count)invalid();
  let cursor=start,total=0;
  const paths=new Set<string>();
  for(let i=0;i<count;i++){
    if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)invalid();
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),packed=view.getUint32(cursor+20,true),unpacked=view.getUint32(cursor+24,true);
    const nameSize=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
    if(flags&1||![0,8].includes(method)||cursor+46+nameSize+extra+comment>end||local+30>start||view.getUint32(local,true)!==0x04034b50)invalid();
    const name=new TextDecoder().decode(bytes.slice(cursor+46,cursor+46+nameSize)).replace(/\\/g,'/');
    if(!name||name.startsWith('/')||name.includes(':')||name.includes('\0')||name.split('/').includes('..')||paths.has(name))throw new HttpError(400,'The ZIP contains unsafe or duplicate file paths.');
    paths.add(name);
    const dataStart=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(dataStart+packed>start||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)invalid();
    total+=unpacked;
    if(total>1024*1024*1024||unpacked>Math.max(1024*1024,packed*500))throw new HttpError(400,'The ZIP expands beyond the supported size.');
    cursor+=46+nameSize+extra+comment;
  }
  if(cursor!==end)invalid();
}
export function inspectUpload(bytes: Uint8Array, kind: string, name: string): string {
  if (!bytes.length) throw new HttpError(400, 'The file is empty.');
  if (kind === 'archive') {
    if (bytes.length > ARCHIVE_LIMIT) throw new HttpError(413, 'Archives must be 25 MB or smaller.');
    if (!/\.zip$/i.test(name) || bytes[0] !== 0x50 || bytes[1] !== 0x4b || !((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))) throw new HttpError(400, 'Upload a ZIP archive.');
    inspectZip(bytes);return 'application/zip';
  }
  if (kind !== 'image') throw new HttpError(400, 'Choose image or archive.');
  if (bytes.length > IMAGE_LIMIT) throw new HttpError(413, 'Images must be 10 MB or smaller.');
  if (bytes.length>32&&bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9 && /\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (bytes.length>=67&&[137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) && /\.png$/i.test(name)&&new TextDecoder().decode(bytes.slice(12,16))==='IHDR'&&new TextDecoder().decode(bytes.slice(-8,-4))==='IEND') return 'image/png';
  const ascii = new TextDecoder().decode(bytes.slice(0, 12)); if (bytes.length>=30&&ascii.startsWith('RIFF') && ascii.endsWith('WEBP') && /\.webp$/i.test(name)&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)+8===bytes.length) return 'image/webp';
  throw new HttpError(400, 'Upload a PNG, JPEG or WebP image. SVG and HTML are not accepted.');
}
