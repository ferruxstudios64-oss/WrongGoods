import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {LaunchSignup} from '@/components/customer-forms';

export default function Home(){
  return <main id="main">
    <section className="home-hero prelaunch-hero">
      <div className="home-hero-copy">
        <p className="eyebrow">INDEPENDENT WORLD-BUILDING ASSET LABEL</p>
        <h1>FICTIONAL<br/>WORLDS<span>need real brands.</span></h1>
        <p className="home-intro">WrongGoods builds fictional brand systems and production-ready graphic assets designed to live quietly inside games, film, television and virtual environments.</p>
        <div className="hero-actions">
          <a className="button" href="#upcoming">See what’s coming <ArrowUpRight size={18}/></a>
          <Link className="text-link" href="/about">What is WrongGoods?</Link>
        </div>
        <p className="home-note">The storefront stays closed until the first file is genuinely ready to ship.</p>
      </div>
      <div className="prelaunch-panel" aria-label="WrongGoods release status">
        <span className="asset-stamp">PRE-LAUNCH / BUILDING THE FIRST WORLD</span>
        <div className="prelaunch-panel-copy">
          <p className="eyebrow">EVIDENCE FILE 001</p>
          <strong>DAYSHIFT</strong>
          <p>A British neighbourhood convenience-store world being built from fascia to receipt.</p>
          <span>STORE STATUS / CLOSED UNTIL RELEASE 001</span>
        </div>
      </div>
    </section>

    <section className="manifest-strip" aria-label="WrongGoods disciplines">
      <span>BRAND SYSTEMS</span><i>/</i><span>PACKAGING</span><i>/</i><span>SIGNAGE</span><i>/</i><span>DOCUMENTS</span><i>/</i><span>GRAPHIC PROPS</span>
    </section>

    <section className="home-statement" id="idea">
      <div><p className="eyebrow">WHAT WRONGGOODS DOES</p><h2>BACKGROUND DETAIL.<br/><em>Foreground thinking.</em></h2></div>
      <div className="statement-copy">
        <p className="statement-lead">The shop at the end of the street. The packet on a shelf. The receipt left on a counter.</p>
        <p>Believable worlds are full of visual systems most people never consciously inspect. WrongGoods builds those systems in full: identity, packaging, signage, paperwork, environmental graphics and the small things that make an invented place feel occupied.</p>
        <div className="tone-pair">
          <article><span>01 / SYSTEMS</span><h3>Not one-off props.</h3><p>Each release is designed as a connected world with rules, variants and enough depth to survive repeated use.</p></article>
          <article><span>02 / PRODUCTION</span><h3>Made to be used.</h3><p>Final releases are organised as practical production assets rather than presentation-only mockups.</p></article>
        </div>
      </div>
    </section>

    <section className="upcoming" id="upcoming">
      <div className="section-heading">
        <div><p className="eyebrow">WHAT’S COMING</p><h2>THE FIRST FILES.</h2></div>
        <p>Work is shown while it is being built. Nothing is sold until the release is complete.</p>
      </div>
      <div className="upcoming-grid">
        <article className="upcoming-primary">
          <div className="upcoming-code"><span>WG-EF-001</span><span>IN DEVELOPMENT</span></div>
          <div className="upcoming-title"><p className="eyebrow">NEIGHBOURHOOD RETAIL / STRAIGHT-FACED</p><h3>DAYSHIFT</h3></div>
          <p>A fictional British corner-shop system covering storefront identity, shelf communication, carrier bags, receipts, food-to-go, notices, packaging and the everyday graphic material around the shop.</p>
          <div className="upcoming-scope"><span>FASCIA</span><span>SHELF</span><span>PACKAGING</span><span>PRINT</span><span>FOOD-TO-GO</span><span>DOCUMENTS</span></div>
        </article>
        <article className="upcoming-next">
          <span className="eyebrow">FUTURE EVIDENCE FILES</span>
          <h3>Different worlds.<br/>Same standard.</h3>
          <p>Future releases will move beyond retail into other believable fictional organisations, products, places and systems. Each one will be built deeply enough to populate a scene rather than decorate a mockup.</p>
          <span className="upcoming-status">NEXT FILE / NOT ANNOUNCED</span>
        </article>
      </div>
    </section>

    <section className="audience" id="audience">
      <div><p className="eyebrow">WHO IT’S FOR</p><h2>WORLD-BUILDERS<br/>WHO NOTICE THE SMALL STUFF.</h2></div>
      <div className="audience-grid">
        <article><span>01</span><h3>Games &amp; environments</h3><p>Studios, environment artists and indie teams building streets, interiors and spaces that need convincing graphic life.</p></article>
        <article><span>02</span><h3>Film &amp; television</h3><p>Art departments, production designers and graphic-prop teams needing fictional systems that hold together across a set.</p></article>
        <article><span>03</span><h3>Virtual production</h3><p>Teams filling digital environments with brands, signs, documents and products that can sit naturally in-frame.</p></article>
        <article><span>04</span><h3>Concept &amp; pitch work</h3><p>Creators who need an invented world to feel established before the first frame is shot or the first level is played.</p></article>
      </div>
    </section>

    <section className="method">
      <p className="eyebrow">THE WRONGGOODS METHOD</p>
      <div className="method-grid">
        <article><span>01</span><h3>BUILD THE WORLD.</h3><p>Define the visual logic, language, materials and rules that make the fictional organisation believable.</p></article>
        <article><span>02</span><h3>MAKE THE GOODS.</h3><p>Extend that logic into the physical and graphic material that would naturally exist around it.</p></article>
        <article><span>03</span><h3>SHIP THE FILES.</h3><p>Release the finished system with clear formats, documentation, licensing and practical production use in mind.</p></article>
      </div>
    </section>

    <LaunchSignup/>

    <section className="contact-strip">
      <div><span className="eyebrow">DIRECT LINE / NO HOLD MUSIC</span><h2>BUILDING SOMETHING<br/>THAT DOESN’T EXIST?</h2></div>
      <Link className="button dark" href="/contact">Tell us about it <ArrowUpRight size={18}/></Link>
    </section>
  </main>
}