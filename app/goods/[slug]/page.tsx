import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {storefrontCatalogue} from '@/lib/storefront';
import {Purchase} from '@/app/storefront-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const {products}=await storefrontCatalogue();
  const p=products.find(x=>x.slug===slug);
  return {title:p?.name||'Collection not found',description:p?.description,robots:{index:false,follow:false}};
}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const {products,unavailable}=await storefrontCatalogue();
  const p=products.find(x=>x.slug===slug);
  if(!p){
    if(unavailable)return <main id="main" className="editorial-page"><header className="editorial-hero"><h1>RELEASES UNAVAILABLE.</h1><p>We could not load this collection. Please try again shortly.</p><Link className="button" href="/goods">Return to the goods</Link></header></main>;
    notFound();
  }

  if(p.slug==='dayshift')return <main id="main" className="dayshift-world">
    <div className="evidence-nav"><Link href="/goods">← Private storefront</Link><span>WG-EF-001 / WORLD STUDY</span></div>

    <section className="dayshift-entry">
      <div>
        <p className="eyebrow">EVIDENCE FILE 001 / DAYSHIFT</p>
        <h1>YOU SHOULDN’T<br/>NOTICE IT.</h1>
        <p className="dayshift-lead">That is the point. DAYSHIFT is designed to sit inside a believable world without asking the scene to stop and look at the branding.</p>
      </div>
      <div className="dayshift-entry-note"><span>WORLD-BUILDING PRINCIPLE</span><p>The assets should register as part of the place: fascia at the edge of frame, price cards on a shelf, a bag behind the counter, a receipt on the floor. Present, coherent, quietly doing the work.</p></div>
    </section>

    <section className="scene-sequence" aria-label="DAYSHIFT environment study">
      {[
        ['01 / STREET APPROACH','EXTERIOR / FASCIA / WINDOW MATERIAL','The shop belongs to the street before the player reaches it.'],
        ['02 / AISLE PASS','SHELF / PRICE / PACKAGING','DAYSHIFT appears through repeated small signals rather than a single hero logo.'],
        ['03 / CHECKOUT','BAGS / RECEIPTS / COUNTER GRAPHICS','The system continues into the places a player only sees for a second.'],
        ['04 / BACKGROUND DETAIL','NOTICES / PRINT / STAFF MATERIAL','Even the low-priority surfaces follow the same visual language.']
      ].map(([code,assets,copy])=><article className="scene-frame" key={code}>
        <div className="scene-visual">
          <span className="scene-cross">+</span>
          <span className="scene-code">{code}</span>
          <span className="scene-assets">{assets}</span>
          <div className="scene-focus"><span>QUIET ASSET ZONE</span></div>
        </div>
        <p>{copy}</p>
      </article>)}
    </section>

    <section className="dossier-grid">
      <div className="dossier-heading"><p className="eyebrow">THE WORLD</p><h2>LOCAL. FAMILIAR.<br/>SLIGHTLY TOO REAL.</h2></div>
      <div className="dossier-copy"><p className="lead">A British neighbourhood convenience-store system built from the outside in.</p><p>Fascia, shelves, price communication, food-to-go, carrier bags, receipts, packaging, staff material and everyday print all belong to the same fictional business. The intention is not to make DAYSHIFT the subject of the scene. It is to make the scene feel more complete because DAYSHIFT is there.</p></div>
    </section>

    <section className="file-manifest">
      <div className="manifest-head"><div><p className="eyebrow">FILE MANIFEST</p><h2>{p.status==='available'?'WHAT YOU GET.':'WHAT IS BEING BUILT.'}</h2></div><span>{p.code}</span></div>
      <div className="manifest-table">{p.contents.map((c,i)=><div className="manifest-row" key={c}><span>{String(i+1).padStart(2,'0')}</span><strong>{c}</strong><em>{p.status==='available'?'INCLUDED':'PLANNED'}</em></div>)}</div>
      <div className="spec-grid"><article><span>FORMATS</span><p>{p.formats.join(' / ')}</p></article><article><span>COMPATIBILITY</span><p>{p.compatibility||'Confirmed at release.'}</p></article><article><span>LICENCE</span><p>{p.licence||'Product-specific rights confirmed before purchase.'}</p></article></div>
      <Purchase product={p}/>
    </section>

    <section className="product-end">
      <div><p className="eyebrow">USAGE / LICENSING</p><h2>USE THE WORLD.<br/>DON’T RESELL THE WORLD.</h2></div>
      <div><p>Standard releases are intended for use inside creative productions. Source assets themselves are not for redistribution as another asset pack.</p><Link className="text-link" href="/licence">Read the licensing approach <ArrowUpRight size={15}/></Link></div>
    </section>
  </main>;

  return <main id="main" className="evidence-file"><div className="evidence-nav"><Link href="/goods">← Private storefront</Link><span>{p.code}</span></div><section className="evidence-hero"><div className="evidence-title"><p className="eyebrow">{p.code} / {p.tone.toUpperCase()}</p><h1>{p.name}</h1><p className="evidence-deck">{p.description}</p><Purchase product={p}/></div></section></main>;
}