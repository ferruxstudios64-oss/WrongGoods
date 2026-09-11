import {notFound} from 'next/navigation';
import Link from 'next/link';
import {storefrontCatalogue} from '@/lib/storefront';
import {Gallery, Purchase} from '@/components/store';
export const dynamic = 'force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {const {slug}=await params;const {products}=await storefrontCatalogue();const p=products.find(x=>x.slug===slug);return {title:p?.name||'Collection not found',description:p?.description};}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const {products,unavailable}=await storefrontCatalogue();const p=products.find(x=>x.slug===slug);
  if(!p){if(unavailable)return <main id="main" className="prose"><h1>RELEASES UNAVAILABLE.</h1><p>We could not load this collection. Please try again shortly.</p><Link className="button" href="/">Return to the storefront</Link></main>;notFound();}
  return <main id="main" className="detail"><Link className="back" href="/#goods">← All goods</Link><div className="detail-grid"><Gallery product={p}/><div><span className="eyebrow">{p.code} / {p.tone}</span><h1>{p.name}</h1><p className="detail-intro">{p.description}</p><Purchase product={p}/><h2>{p.status==='available'?'Included files':'Planned contents'}</h2><ul>{p.contents.map(c=><li key={c}>{c}</li>)}</ul><h2>File formats</h2><p>{p.formats.join(' / ')}</p><h2>Compatibility</h2><p>{p.compatibility||'Software compatibility has not been verified. Details will be confirmed at release.'}</p><h2>Licence</h2><p className="licence-copy">{p.licence||'Intended for fictional worlds and creative productions. Product-specific rights will be shown before purchase.'}</p><Link className="text-link" href="/licence">Read the licensing approach ↗</Link></div></div></main>;
}
