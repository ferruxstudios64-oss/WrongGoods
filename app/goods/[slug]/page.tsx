import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {storefrontCatalogue} from '@/lib/storefront';
import {Gallery, Purchase} from '@/app/storefront-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const {products}=await storefrontCatalogue();
  const p=products.find(x=>x.slug===slug);
  return {title:p?.name||'Collection not found',description:p?.description};
}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const {products,unavailable}=await storefrontCatalogue();
  const p=products.find(x=>x.slug===slug);
  if(!p){
    if(unavailable)return <main id="main" className="editorial-page"><header className="editorial-hero"><h1>RELEASES UNAVAILABLE.</h1><p>We could not load this collection. Please try again shortly.</p><Link className="button" href="/goods">Return to the goods</Link></header></main>;
    notFound();
  }
  const isDayshift=p.slug==='dayshift';
  return <main id="main" className="evidence-file">
    <div className="evidence-nav"><Link href="/goods">← All goods</Link><span>{p.code} / {p.status==='available'?'RELEASED':'IN DEVELOPMENT'}</span></div>

    <section className="evidence-hero">
      <div className="evidence-title">
        <p className="eyebrow">{isDayshift?'EVIDENCE FILE 001':p.code} / {p.tone.toUpperCase()}</p>
        <h1>{p.name}</h1>
        <p className="evidence-deck">{p.description}</p>
        <Purchase product={p}/>
      </div>
      <Gallery product={p}/>
    </section>

    <section className="dossier-grid">
      <div className="dossier-heading"><p className="eyebrow">THE WORLD</p><h2>{isDayshift?'LOCAL. FAMILIAR. SLIGHTLY TOO REAL.':'BUILT TO BELONG.'}</h2></div>
      <div className="dossier-copy">
        {isDayshift ? <>
          <p className="lead">DAYSHIFT is a British neighbourhood convenience-store world built as one connected visual system.</p>
          <p>Not a logo dropped onto a few mockups. The identity extends into shelf labels, carrier bags, receipts, price communication, food-to-go, staff material, storefront graphics and the everyday print that makes the shop feel occupied.</p>
        </> : <p className="lead">A coherent fictional system designed to hold up across the small details of a scene.</p>}
      </div>
    </section>

    <section className="file-manifest">
      <div className="manifest-head"><div><p className="eyebrow">FILE MANIFEST</p><h2>{p.status==='available'?'WHAT YOU GET.':'WHAT IS BEING BUILT.'}</h2></div><span>{p.code}</span></div>
      <div className="manifest-table">
        {p.contents.map((c,i)=><div className="manifest-row" key={c}><span>{String(i+1).padStart(2,'0')}</span><strong>{c}</strong><em>{p.status==='available'?'INCLUDED':'PLANNED'}</em></div>)}
      </div>
      <div className="spec-grid">
        <article><span>FORMATS</span><p>{p.formats.join(' / ')}</p></article>
        <article><span>COMPATIBILITY</span><p>{p.compatibility||'Confirmed at release.'}</p></article>
        <article><span>LICENCE</span><p>{p.licence||'Product-specific rights confirmed before purchase.'}</p></article>
      </div>
    </section>

    <section className="product-end">
      <div><p className="eyebrow">USAGE / LICENSING</p><h2>USE THE WORLD.<br/>DON’T RESELL THE WORLD.</h2></div>
      <div><p>Standard releases are intended for use inside creative productions. Source assets themselves are not for redistribution as another asset pack.</p><Link className="text-link" href="/licence">Read the licensing approach <ArrowUpRight size={15}/></Link></div>
    </section>
  </main>;
}