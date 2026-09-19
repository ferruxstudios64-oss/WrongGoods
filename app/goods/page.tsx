import {Catalogue} from '@/app/storefront-ui';
import {storefrontCatalogue} from '@/lib/storefront';
export const metadata={title:'Goods'};
export const dynamic='force-dynamic';
export default async function Goods(){
  const catalogue=await storefrontCatalogue();
  return <main id="main" className="goods-page">
    <section className="page-intro">
      <p className="eyebrow">THE RELEASE MANIFEST</p>
      <h1>THE GOODS.</h1>
      <p>Evidence files, fictional brand systems and production-ready graphic assets. Released work sits beside work in progress, clearly marked.</p>
    </section>
    <Catalogue {...catalogue}/>
  </main>
}