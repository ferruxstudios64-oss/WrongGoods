import {CustomerForm} from '@/components/customer-forms';
export const metadata={title:'Contact'};
export default function Contact(){return <main id="main" className="contact-page">
  <header><p className="eyebrow">DIRECT LINE / NO HOLD MUSIC</p><h1>TELL US<br/>ABOUT IT.</h1><p>A production in progress. A release question. A missing receipt. Keep it useful.</p></header>
  <div className="contact-form-wrap"><CustomerForm kind="contact"/><aside><span>EMAIL</span><a href="mailto:hello@wronggoods.com">hello@wronggoods.com ↗</a><span>INSTAGRAM</span><a href="https://www.instagram.com/wronggoodsco/" target="_blank" rel="noopener noreferrer">@wronggoodsco ↗</a><span>ORDER HELP</span><a href="/order">Orders & downloads ↗</a></aside></div>
</main>}