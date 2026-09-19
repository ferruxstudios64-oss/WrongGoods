'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Search,Menu,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetTrigger,SheetClose} from '@/components/ui/sheet';
import {categories,type Product,purchasable} from '@/lib/catalog';

export function Header(){return <>
  <div className="dispatch"><span>WRONGGOODS / INDEPENDENT WORLD-BUILDING ASSET LABEL</span><span>FICTIONAL WORLDS NEED REAL BRANDS.</span></div>
  <header className="header">
    <Link className="brand-link" href="/" aria-label="WrongGoods home"><img className="logo" src="/brand/wronggoods-wordmark-bone.svg" alt="WrongGoods" width="240" height="75"/></Link>
    <nav aria-label="Main navigation"><Link href="/about">The label</Link><Link href="/#upcoming">What’s coming</Link><Link href="/#audience">For who</Link><Link href="/contact">Contact</Link></nav>
    <Link className="order-link" href="/owner">Owner access</Link>
    <Sheet><SheetTrigger className="mobile-menu" aria-label="Open menu"><Menu/></SheetTrigger><SheetContent className="!bg-[#0c0c0c] !text-[#eae7da] !border-[#34342f] p-7"><SheetTitle className="!text-[#eae7da]">WrongGoods</SheetTitle><nav className="flex flex-col gap-6 pt-6 text-lg">{[['Goods','/goods'],['The label','/about'],['Licensing','/licence'],['Contact','/contact'],['Orders & downloads','/order']].map(([text,href])=><SheetClose asChild key={href}><Link href={href}>{text}</Link></SheetClose>)}</nav></SheetContent></Sheet>
  </header>
</>}

export function Footer(){return <footer>
  <div className="footer-mark"><img src="/brand/wg-mark-yellow.svg" alt="" aria-hidden="true"/><p>THE WRONG GOODS.<br/><em>IN THE RIGHT HANDS.</em></p></div>
  <div className="footer-wordmark"><img src="/brand/wronggoods-wordmark-bone.svg" alt="WrongGoods"/></div>
  <div className="footer-bottom"><span>© {new Date().getFullYear()} WRONGGOODS</span><Link href="/goods">Goods</Link><Link href="/licence">Licensing</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link><Link href="/privacy">Privacy</Link><Link href="/order">Orders</Link><a href="https://www.instagram.com/wronggoodsco/" target="_blank" rel="noopener noreferrer">Instagram ↗</a></div>
</footer>}

export function Catalogue({products,unavailable=false}:{products:Product[];unavailable?:boolean}) {
  const [category,setCategory]=useState('All goods'); const [query,setQuery]=useState(''); const [tone,setTone]=useState('All tones');
  useEffect(()=>{const restore=()=>{const params=new URLSearchParams(location.search);setCategory(params.get('department')||'All goods');setQuery(params.get('q')||'');setTone(params.get('tone')||'All tones');};restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[]);
  function filter(nextCategory:string,nextQuery:string,nextTone:string){setCategory(nextCategory);setQuery(nextQuery);setTone(nextTone);const url=new URL(location.href);for(const [key,value,empty] of [['department',nextCategory,'All goods'],['q',nextQuery,''],['tone',nextTone,'All tones']]){if(value===empty)url.searchParams.delete(key);else url.searchParams.set(key,value);}history.replaceState(null,'',url);}
  const departments=[...new Set([...categories,...products.map(p=>p.category)])];
  const filtered=products.filter(p=>(category==='All goods'||p.category===category)&&(tone==='All tones'||p.tone===tone)&&`${p.name} ${p.description} ${p.category} ${p.tone} ${p.contents.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const released=products.some(p=>p.status==='available');
  return <section className="catalogue" id="goods">
    <div className="section-heading"><div><span className="eyebrow">THE RELEASE MANIFEST</span><h2>{released?'THE GOODS.':'GOODS IN THE MAKING.'}</h2></div><p>{released?'Released collections and work in progress.':'Evidence File 001 is currently on the workbench.'}</p></div>
    {unavailable&&<p role="status" className="service-note">Live releases could not be loaded. Concept previews remain available.</p>}
    <div className="catalogue-tools"><div className="filters" aria-label="Filter by department">{departments.map(c=><button key={c} aria-pressed={category===c} onClick={()=>filter(c,query,tone)}>{c}</button>)}</div><label className="search"><Search size={17}/><span className="sr-only">Search goods</span><input type="search" placeholder="Search the manifest" value={query} onChange={e=>filter(category,e.target.value,tone)}/>{query&&<button aria-label="Clear search" onClick={()=>filter(category,'',tone)}><X size={15}/></button>}</label></div>
    <div className="catalogue-summary"><p className="result-count" aria-live="polite">{filtered.length} {filtered.length===1?'file':'files'}</p><label className="tone-filter">Tone <select value={tone} onChange={e=>filter(category,query,e.target.value)}><option>All tones</option><option>Straight-faced</option><option>Satirical</option></select></label></div>
    <div className="product-grid">{filtered.map(p=><Link className="product" key={p.slug} href={`/goods/${p.slug}`}><div className={`product-art ${p.status==='in-development'?p.slug:''}`}>{p.image?<img src={p.image} alt={`${p.name} ${p.status==='in-development'?'concept':'product'} preview`} loading="lazy" width={900} height={700}/>:<div className="type-cover"><span>{p.code}</span><strong>{p.name}</strong><span>{p.category.toUpperCase()}</span></div>}<span className="status-tag">{p.status==='available'?'RELEASED':'IN DEVELOPMENT'}</span></div><div className="product-code"><span>{p.code}</span><span>{p.category} / {p.tone}</span></div><div className="product-title-row"><h3>{p.name}</h3><ArrowUpRight/></div><p>{p.description}</p><div className="product-bottom"><span>{p.status==='available'?`£${p.priceGBP?.toFixed(2)}`:'Price confirmed at release'}</span><span>Open evidence file ↗</span></div></Link>)}</div>
    {!filtered.length&&<div className="empty"><h3>No goods filed under that search.</h3><p>Try another term, or reset the filters.</p><button className="button" onClick={()=>filter('All goods','','All tones')}>Reset filters</button></div>}
  </section>;
}

export function Gallery({product:p}:{product:Product}) {
  const images=p.images?.length?p.images:p.image?[p.image]:[]; const [selected,setSelected]=useState(0);
  return <div className="evidence-gallery">{images.length?<><div className="gallery-main"><img className="detail-image" src={images[selected]||images[0]} alt={`${p.name} ${p.status==='in-development'?'concept':'product'} preview ${selected+1}`} width={1000} height={1000}/><span className="asset-stamp">FIELD STUDY / {String(selected+1).padStart(3,'0')}</span></div>{images.length>1&&<div className="gallery-thumbs" aria-label="Product images">{images.map((src,index)=><button key={src} aria-label={`View image ${index+1}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><img src={src} alt="" width={96} height={96}/></button>)}</div>}</>:<div className={`detail-type ${p.slug}`}><span>{p.code}</span><strong>{p.name}</strong><span>CONCEPT IN DEVELOPMENT</span></div>}<p className="caption">{p.status==='in-development'?'Concept study. The final downloadable contents are represented by the manifest, not this image.':'Product preview. Refer to the verified manifest and licence for included files.'}</p></div>;
}

export function Purchase({product:p}:{product:Product}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function checkout(){setBusy(true);setError('');try{const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:p.slug})});const data=await r.json() as {error?:string;url?:string};if(!r.ok)throw Error(data.error||'Checkout is unavailable.');if(!data.url)throw Error('Checkout is unavailable.');window.location.assign(data.url)}catch(e){setError(e instanceof Error?e.message:'Checkout is unavailable.');setBusy(false)}}
  if(p.status==='available')return <div className="purchase-panel"><div><span>RELEASE PRICE</span><strong>£{p.priceGBP?.toFixed(2)}</strong></div><p>One-time purchase. Hosted checkout. Any applicable taxes are shown before payment.</p><button className="button" disabled={busy||!purchasable(p)} onClick={checkout}>{busy?'Opening checkout…':purchasable(p)?'Acquire file ↗':'Checkout unavailable'}</button>{error&&<p role="alert">{error}</p>}<Link className="text-link" href="/order">Already purchased? Recover your order</Link></div>;
  return <div className="purchase-panel"><div><span>STATUS</span><strong>IN DEVELOPMENT</strong></div><p>Final contents, formats, price and licence will be confirmed before release.</p><Link className="button" href="/#updates">Get release updates <ArrowUpRight size={17}/></Link><Link className="text-link" href="/contact">Ask about this file</Link></div>;
}
