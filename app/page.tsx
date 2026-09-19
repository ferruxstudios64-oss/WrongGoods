import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Catalogue} from '@/app/storefront-ui';
import {LaunchSignup} from '@/components/customer-forms';
import {storefrontCatalogue} from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const catalogue=await storefrontCatalogue();
  return <main id="main">
    <section className="home-hero">
      <div className="home-hero-copy">
        <p className="eyebrow">INDEPENDENT WORLD-BUILDING ASSET LABEL</p>
        <h1>FICTIONAL<br/>WORLDS<span>need real brands.</span></h1>
        <p className="home-intro">Cohesive fictional brand systems and production-ready graphic assets for games, film, television and virtual worlds.</p>
        <div className="hero-actions">
          <Link className="button" href="/goods">Browse the goods <ArrowUpRight size={18}/></Link>
          <Link className="text-link" href="/goods/dayshift">Open Evidence File 001</Link>
        </div>
        <p className="home-note">Built to survive the second look. Designed as systems, not disconnected props.</p>
      </div>
      <Link className="home-feature" href="/goods/dayshift" aria-label="Open DAYSHIFT Evidence File 001">
        <img src="/images/dayshift.webp" alt="DAYSHIFT fictional neighbourhood retail world concept study" fetchPriority="high"/>
        <span className="asset-stamp">EVIDENCE FILE 001</span>
        <div className="feature-caption">
          <div><span>NEIGHBOURHOOD RETAIL / IN DEVELOPMENT</span><strong>DAYSHIFT</strong><p>A British convenience-store world, built end to end.</p></div>
          <span className="round-arrow"><ArrowUpRight/></span>
        </div>
      </Link>
    </section>

    <section className="manifest-strip" aria-label="WrongGoods disciplines">
      <span>BRAND SYSTEMS</span><i>/</i><span>PACKAGING</span><i>/</i><span>SIGNAGE</span><i>/</i><span>DOCUMENTS</span><i>/</i><span>GRAPHIC PROPS</span>
    </section>

    <section className="home-statement">
      <div><p className="eyebrow">THE DETAILS DO THE WORLD BUILDING.</p><h2>IT DOESN'T EXIST.<br/><em>It should feel like it does.</em></h2></div>
      <div className="statement-copy">
        <p className="statement-lead">The shop in the background. The receipt nobody reads. The notice on the staff-room door.</p>
        <p>WrongGoods creates the complete visual systems around fictional places, products and institutions. Each release is designed to work as a world, then packaged so production teams can actually use it.</p>
        <div className="tone-pair">
          <article><span>01 / STRAIGHT-FACED</span><h3>It could exist.</h3><p>Convincing enough to pass without explanation.</p></article>
          <article><span>02 / SATIRICAL</span><h3>It probably shouldn't.</h3><p>Dry enough that the second look earns it.</p></article>
        </div>
      </div>
    </section>

    <Catalogue {...catalogue}/>

    <section className="method">
      <p className="eyebrow">THE WRONGGOODS METHOD</p>
      <div className="method-grid">
        <article><span>01</span><h3>BUILD THE WORLD.</h3><p>Identity, language, materials and the small visual rules that make it coherent.</p></article>
        <article><span>02</span><h3>MAKE THE GOODS.</h3><p>Packaging, signage, paperwork and graphic props with enough depth to hold up in use.</p></article>
        <article><span>03</span><h3>SHIP THE FILES.</h3><p>Clearly organised, production-ready assets with formats, documentation and licence terms stated before purchase.</p></article>
      </div>
    </section>

    <LaunchSignup/>

    <section className="contact-strip">
      <div><span className="eyebrow">DIRECT LINE / NO HOLD MUSIC</span><h2>BUILDING SOMETHING<br/>THAT DOESN'T EXIST?</h2></div>
      <Link className="button dark" href="/contact">Tell us about it <ArrowUpRight size={18}/></Link>
    </section>
  </main>
}